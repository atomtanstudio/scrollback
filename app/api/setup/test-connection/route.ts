import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  type: z.enum(["postgresql", "supabase", "sqlite"]),
  url: z.string().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  supabaseUrl: z.string().optional(),
  supabaseAnonKey: z.string().optional(),
  supabaseServiceKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { connected: false, pgvector: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { type } = parsed.data;

    if (type === "sqlite") {
      return testSqliteConnection(parsed.data);
    } else {
      return testPgConnection(parsed.data);
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json(
      { connected: false, pgvector: false, error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}

async function testSqliteConnection(data: z.infer<typeof requestSchema>) {
  const fs = await import("fs");
  const path = await import("path");

  const dbUrl = data.url || "file:./feedsilo.db";
  const filePath = dbUrl.replace(/^file:/, "");
  const dir = path.dirname(path.resolve(filePath));

  try {
    fs.accessSync(dir, fs.constants.W_OK);
    return NextResponse.json({ connected: true, pgvector: false });
  } catch {
    return NextResponse.json({
      connected: false,
      pgvector: false,
      error: `Directory not writable: ${dir}`,
    });
  }
}

async function testPgConnection(data: z.infer<typeof requestSchema>) {
  let connectionString = data.url;

  // Build connection string from individual fields if not provided
  if (!connectionString && data.host) {
    const user = data.username || "postgres";
    const pass = data.password ? `:${data.password}` : "";
    const port = data.port || 5432;
    const db = data.database || "feedsilo";
    connectionString = `postgresql://${user}${pass}@${data.host}:${port}/${db}`;
  }

  // For Supabase, construct from project URL
  if (!connectionString && data.supabaseUrl) {
    return NextResponse.json({
      connected: false,
      pgvector: false,
      error: "Please provide a PostgreSQL connection string for Supabase",
    });
  }

  if (!connectionString) {
    return NextResponse.json({
      connected: false,
      pgvector: false,
      error: "No connection string provided",
    });
  }

  // Test connection using pg directly
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 10000 });

  try {
    const client = await pool.connect();

    // Test basic query
    await client.query("SELECT 1");

    // Check for pgvector extension
    let pgvector = false;
    try {
      const extResult = await client.query(
        "SELECT 1 FROM pg_extension WHERE extname = 'vector'"
      );
      pgvector = extResult.rows.length > 0;
    } catch {
      // pgvector check failed — not available
    }

    client.release();
    await pool.end();

    return NextResponse.json({ connected: true, pgvector });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    await pool.end().catch(() => {});
    return NextResponse.json({
      connected: false,
      pgvector: false,
      error: error.message || "Connection failed",
    });
  }
}
