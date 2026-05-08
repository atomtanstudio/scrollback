import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeConfig, invalidateConfigCache, type ScrollbackConfig } from "@/lib/config";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { redactSensitiveText, sanitizeErrorMessage } from "@/lib/security/redact";
import { requireSetupUnlocked } from "@/lib/setup/guard";

const execAsync = promisify(exec);

function resolveSqliteFilePath(databaseUrl: string): string | null {
  if (!databaseUrl.startsWith("file:")) return null;
  const filePath = databaseUrl.slice("file:".length);
  if (!filePath) return null;
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), filePath);
}

function normalizeSqliteDatabaseUrl(databaseUrl: string): string {
  const sqlitePath = resolveSqliteFilePath(databaseUrl);
  return sqlitePath ? `file:${sqlitePath}` : databaseUrl;
}

async function deleteSqliteDatabaseFiles(databaseUrl: string): Promise<void> {
  const sqlitePath = resolveSqliteFilePath(databaseUrl);
  if (!sqlitePath) return;

  const candidatePaths = [
    sqlitePath,
    `${sqlitePath}-wal`,
    `${sqlitePath}-shm`,
    `${sqlitePath}-journal`,
  ];

  await Promise.all(
    candidatePaths.map(async (candidatePath) => {
      try {
        await fs.unlink(candidatePath);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") throw error;
      }
    })
  );
}

async function pushSchema(config: ScrollbackConfig, schemaFlag: string): Promise<void> {
  await execAsync(`npx prisma db push ${schemaFlag} --accept-data-loss`, {
    env: { ...process.env, DATABASE_URL: config.database.url },
    timeout: 30000,
  });
}

async function ensureSqliteDatabaseFile(databaseUrl: string): Promise<void> {
  const sqlitePath = resolveSqliteFilePath(databaseUrl);
  if (!sqlitePath) return;
  await fs.mkdir(/* turbopackIgnore: true */ path.dirname(sqlitePath), { recursive: true });
  const handle = await fs.open(/* turbopackIgnore: true */ sqlitePath, "a");
  await handle.close();
}

async function verifySqliteSchema(databaseUrl: string): Promise<void> {
  const sqlitePath = resolveSqliteFilePath(databaseUrl);
  if (!sqlitePath) {
    throw new Error("Invalid SQLite database path");
  }

  const { default: Database } = await import("better-sqlite3");
  const db = new Database(sqlitePath, { readonly: true });

  try {
    const contentItemsTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get("content_items");

    if (!contentItemsTable) {
      throw new Error("SQLite setup completed without creating the content_items table");
    }
  } finally {
    db.close();
  }
}

function getExecErrorText(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const maybeError = error as { stderr?: unknown; message?: unknown };
    if (typeof maybeError.stderr === "string" && maybeError.stderr) return maybeError.stderr;
    if (typeof maybeError.message === "string" && maybeError.message) return maybeError.message;
  }
  return "Unknown error";
}

const requestSchema = z.object({
  database: z.object({
    type: z.enum(["postgresql", "supabase", "sqlite"]),
    url: z.string().min(1),
  }),
  embeddings: z.object({
    provider: z.enum(["gemini", "openai"]).default("gemini"),
    apiKey: z.string().optional(),
  }).optional(),
  extension: z.object({
    pairingToken: z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const locked = await requireSetupUnlocked(request, { allowAdmin: true });
    if (locked) return locked;

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const database =
      parsed.data.database.type === "sqlite"
        ? {
            ...parsed.data.database,
            url: normalizeSqliteDatabaseUrl(parsed.data.database.url),
          }
        : parsed.data.database;

    const config: ScrollbackConfig = {
      database,
      embeddings: parsed.data.embeddings || { provider: "gemini" },
      extension: parsed.data.extension || {},
      xapi: {},
      search: { keywordWeight: 0.4, semanticWeight: 0.6 },
      localMedia: {},
    };

    // Run Prisma db push
    const schemaFlag =
      config.database.type === "sqlite"
        ? "--schema=prisma/schema-sqlite.prisma"
        : "--schema=prisma/schema.prisma";

    try {
      if (config.database.type === "sqlite") {
        await ensureSqliteDatabaseFile(config.database.url);
      }
      await pushSchema(config, schemaFlag);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const stderr = getExecErrorText(error);
      const needsSqliteReset =
        config.database.type === "sqlite" &&
        stderr.includes("content_items_fts_config");

      if (needsSqliteReset) {
        try {
          await deleteSqliteDatabaseFiles(config.database.url);
          await pushSchema(config, schemaFlag);
        } catch (retryError: unknown) {
          return NextResponse.json({
            success: false,
            error: `Migration failed: ${redactSensitiveText(getExecErrorText(retryError))}`,
          });
        }
      } else {
        return NextResponse.json({
          success: false,
          error: `Migration failed: ${redactSensitiveText(stderr)}`,
        });
      }
    }

    if (config.database.type === "sqlite") {
      try {
        await verifySqliteSchema(config.database.url);
      } catch (error: unknown) {
        return NextResponse.json({
          success: false,
          error: `Migration failed: ${redactSensitiveText(getExecErrorText(error))}`,
        });
      }
    }

    // Write config files only after schema setup succeeds. This avoids locking
    // onboarding into a partially configured instance after a failed migration.
    writeConfig(config);
    invalidateConfigCache();

    // For PostgreSQL, try to create pgvector extension
    if (config.database.type !== "sqlite") {
      try {
        const { default: pg } = await import("pg");
        const pool = new pg.Pool({ connectionString: config.database.url });
        const client = await pool.connect();
        await client.query("CREATE EXTENSION IF NOT EXISTS vector");
        client.release();
        await pool.end();
      } catch {
        // Non-fatal — user may not have superuser privileges
      }
    }

    // For SQLite, create FTS5 virtual table + sync triggers
    if (config.database.type === "sqlite") {
      try {
        const { SqliteSearchProvider } = await import("@/lib/db/providers/sqlite");
        const provider = new SqliteSearchProvider();
        await provider.ensureFts5Table();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // Log but don't fail — FTS5 can be created later
        console.warn("FTS5 table creation failed:", sanitizeErrorMessage(error, "Unknown error"));
      }
    }

    // Set cookie so middleware knows app is configured (Edge Runtime can't read fs)
    const response = NextResponse.json({ success: true });
    response.cookies.set("scrollback-configured", "true", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
    });
    return response;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(error, "Unknown error") },
      { status: 500 }
    );
  }
}
