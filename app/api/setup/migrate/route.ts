import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeConfig, invalidateConfigCache, type FeedsiloConfig } from "@/lib/config";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const requestSchema = z.object({
  database: z.object({
    type: z.enum(["postgresql", "supabase", "sqlite"]),
    url: z.string().min(1),
  }),
  embeddings: z.object({
    provider: z.enum(["gemini"]).default("gemini"),
    apiKey: z.string().optional(),
  }).optional(),
  extension: z.object({
    pairingToken: z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const config: FeedsiloConfig = {
      database: parsed.data.database,
      embeddings: parsed.data.embeddings || { provider: "gemini" },
      extension: parsed.data.extension || {},
      search: { keywordWeight: 0.4, semanticWeight: 0.6 },
    };

    // Write config files
    writeConfig(config);
    invalidateConfigCache();

    // Run Prisma db push
    const schemaFlag =
      config.database.type === "sqlite"
        ? "--schema=prisma/schema-sqlite.prisma"
        : "--schema=prisma/schema.prisma";

    try {
      await execAsync(`npx prisma db push ${schemaFlag} --accept-data-loss --skip-generate`, {
        env: { ...process.env, DATABASE_URL: config.database.url },
        timeout: 30000,
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        error: `Migration failed: ${error.stderr || error.message}`,
      });
    }

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
        console.warn("FTS5 table creation failed:", error.message);
      }
    }

    // Set cookie so middleware knows app is configured (Edge Runtime can't read fs)
    const response = NextResponse.json({ success: true });
    response.cookies.set("feedsilo-configured", "true", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
    });
    return response;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
