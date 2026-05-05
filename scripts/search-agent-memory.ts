import { config } from "dotenv";
config({ path: ".env.local" });
config();

import pg from "pg";
import {
  generateEmbeddingWithDimensions,
  getAiProviderLabel,
  isAiConfigured,
} from "../lib/embeddings";

type Mode = "keyword" | "vector" | "hybrid";
type Dimensions = 768 | 1536;

type Args = {
  databaseUrl?: string;
  userEmail?: string;
  userId?: string;
  query?: string;
  mode: Mode;
  dimensions: Dimensions;
  limit: number;
  json: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    mode: "hybrid",
    dimensions: 768,
    limit: 20,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--database-url") {
      args.databaseUrl = next;
      i += 1;
    } else if (arg === "--user-email") {
      args.userEmail = next;
      i += 1;
    } else if (arg === "--user-id") {
      args.userId = next;
      i += 1;
    } else if (arg === "--query" || arg === "-q") {
      args.query = next;
      i += 1;
    } else if (arg === "--mode") {
      if (next !== "keyword" && next !== "vector" && next !== "hybrid") {
        throw new Error("--mode must be keyword, vector, or hybrid");
      }
      args.mode = next;
      i += 1;
    } else if (arg === "--dimensions") {
      const parsed = parseInt(next || "768", 10);
      if (parsed !== 768 && parsed !== 1536) {
        throw new Error("--dimensions must be 768 or 1536");
      }
      args.dimensions = parsed;
      i += 1;
    } else if (arg === "--limit") {
      args.limit = Math.min(200, Math.max(1, parseInt(next || "20", 10)));
      i += 1;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
Search the Scrollback agent memory index without opening the web app.

Usage:
  npx tsx scripts/search-agent-memory.ts \\
    --user-email you@example.com \\
    --query "agent orchestration"

Options:
  --database-url URL   PostgreSQL URL. Defaults to DATABASE_URL.
  --user-email EMAIL   Search one user by email.
  --user-id UUID       Search one user by id.
  --query, -q TEXT     Search query.
  --mode MODE          keyword, vector, or hybrid. Default: hybrid.
  --dimensions N       768 or 1536. Default: 768.
  --limit N            Max results. Default: 20.
  --json               Print raw JSON.
`);
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

async function resolveUserId(client: pg.Client, args: Args): Promise<string> {
  if (args.userId) return args.userId;
  if (!args.userEmail) {
    const result = await client.query<{ id: string; email: string }>(
      `SELECT id, email FROM users ORDER BY created_at ASC`
    );
    if (result.rowCount === 1) return result.rows[0].id;
    throw new Error("Multiple users found. Pass --user-email or --user-id.");
  }

  const result = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE lower(email) = lower($1)`,
    [args.userEmail]
  );
  if (result.rowCount !== 1) {
    throw new Error(`No unique user found for email: ${args.userEmail}`);
  }
  return result.rows[0].id;
}

function printTextResults(rows: Array<Record<string, unknown>>): void {
  for (const [index, row] of rows.entries()) {
    const title = String(row.title || "(untitled)");
    const score =
      typeof row.score === "number" ? row.score.toFixed(3) : String(row.score || "");
    const url = row.source_url ? `\n   ${row.source_url}` : "";
    const text = String(row.chunk_text || "").replace(/\s+/g, " ").slice(0, 280);
    console.log(`${index + 1}. ${title} [${score}]${url}\n   ${text}\n`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = required(
    args.databaseUrl || process.env.DATABASE_URL,
    "Missing DATABASE_URL. Pass --database-url or set DATABASE_URL."
  );
  const query = required(args.query, "Missing query. Pass --query.");

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const userId = await resolveUserId(client, args);
    let result: pg.QueryResult;

    if (args.mode === "keyword") {
      result = await client.query(
        `SELECT * FROM agent_memory_keyword_search($1::uuid, $2::text, $3::integer)`,
        [userId, query, args.limit]
      );
    } else {
      if (!isAiConfigured()) {
        throw new Error(`${getAiProviderLabel()} API key is not configured.`);
      }
      const embedding = await generateEmbeddingWithDimensions(query, args.dimensions);
      const vector = `[${embedding.join(",")}]`;
      if (args.mode === "vector") {
        const fn =
          args.dimensions === 1536
            ? "agent_memory_vector_search_1536"
            : "agent_memory_vector_search_768";
        result = await client.query(
          `SELECT * FROM ${fn}($1::uuid, $2::vector, $3::integer)`,
          [userId, vector, args.limit]
        );
      } else {
        const fn =
          args.dimensions === 1536
            ? "agent_memory_hybrid_search_1536"
            : "agent_memory_hybrid_search_768";
        result = await client.query(
          `SELECT * FROM ${fn}($1::uuid, $2::text, $3::vector, $4::integer)`,
          [userId, query, vector, args.limit]
        );
      }
    }

    if (args.json) {
      console.log(JSON.stringify(result.rows, null, 2));
    } else {
      printTextResults(result.rows);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
