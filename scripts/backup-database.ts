import { config } from "dotenv";
config({ path: ".env.local" });
config();

import fs from "fs/promises";
import path from "path";
import { gzip } from "zlib";
import { promisify } from "util";
import pg from "pg";

const gzipAsync = promisify(gzip);

type Args = {
  databaseUrl?: string;
  output?: string;
};

type TableRow = {
  table_name: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--database-url") {
      args.databaseUrl = next;
      i += 1;
    } else if (arg === "--output") {
      args.output = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`
Create a logical JSON backup of all public Scrollback tables.

Usage:
  npx tsx scripts/backup-database.ts

Options:
  --database-url URL   PostgreSQL URL. Defaults to DATABASE_URL.
  --output PATH        Backup file path. Defaults to backups/scrollback-backup-<timestamp>.json.gz.
`);
}

function requireValue(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function publicTables(client: pg.Client): Promise<string[]> {
  const result = await client.query<TableRow>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `
  );
  return result.rows.map((row) => row.table_name);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function tableRows(client: pg.Client, table: string): Promise<unknown[]> {
  const result = await client.query(`SELECT * FROM ${quoteIdentifier(table)}`);
  return result.rows;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = requireValue(
    args.databaseUrl || process.env.DATABASE_URL,
    "Missing DATABASE_URL. Pass --database-url or set DATABASE_URL."
  );
  if (!databaseUrl.startsWith("postgres")) {
    throw new Error("This backup script is for PostgreSQL/Supabase databases.");
  }

  const outputPath =
    args.output ||
    path.join(process.cwd(), "backups", `scrollback-backup-${timestamp()}.json.gz`);

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const tables = await publicTables(client);
    const data: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};

    for (const table of tables) {
      const rows = await tableRows(client, table);
      data[table] = rows;
      counts[table] = rows.length;
    }

    const payload = {
      format_version: 1,
      exported_at: new Date().toISOString(),
      database: {
        type: "postgresql",
        table_count: tables.length,
      },
      counts,
      data,
    };

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const compressed = await gzipAsync(JSON.stringify(payload, null, 2));
    await fs.writeFile(outputPath, compressed);

    console.log(
      JSON.stringify(
        {
          ok: true,
          output: outputPath,
          tables: tables.length,
          counts,
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
