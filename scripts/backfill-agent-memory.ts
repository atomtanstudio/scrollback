import { config } from "dotenv";
config({ path: ".env.local" });
config();

import pg from "pg";
import {
  buildAgentMemoryChunks,
  type AgentMemorySourceItem,
} from "../lib/agent-memory/chunking";
import {
  AGENT_MEMORY_OPTIONAL_INDEX_SQL,
  AGENT_MEMORY_SCHEMA_SQL,
} from "../lib/agent-memory/schema";
import {
  generateEmbeddingsWithDimensions,
  getAiProviderLabel,
  getEmbeddingModelLabel,
  isAiConfigured,
} from "../lib/embeddings";

type Args = {
  databaseUrl?: string;
  userEmail?: string;
  userId?: string;
  limit: number;
  embed: boolean;
  force: boolean;
  dimensions: 768 | 1536;
  batchSize: number;
};

type SourceItemRow = AgentMemorySourceItem & {
  tags: string[];
  categories: string[];
  media_descriptions: string[];
};

type ChunkRow = {
  id: string;
  chunk_text: string;
  title: string;
  author_handle: string | null;
  author_display_name: string | null;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    limit: 500,
    embed: true,
    force: false,
    dimensions: 768,
    batchSize: 16,
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
    } else if (arg === "--limit") {
      args.limit = Math.max(1, parseInt(next || "500", 10));
      i += 1;
    } else if (arg === "--batch-size") {
      args.batchSize = Math.max(1, parseInt(next || "16", 10));
      i += 1;
    } else if (arg === "--dimensions") {
      const parsed = parseInt(next || "768", 10);
      if (parsed !== 768 && parsed !== 1536) {
        throw new Error("--dimensions must be 768 or 1536");
      }
      args.dimensions = parsed;
      i += 1;
    } else if (arg === "--chunks-only") {
      args.embed = false;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
Backfill FeedSilo content into the agent memory chunk/vector index.

Usage:
  npx tsx scripts/backfill-agent-memory.ts --user-email you@example.com

Options:
  --database-url URL   PostgreSQL URL. Defaults to DATABASE_URL.
  --user-email EMAIL   Backfill one user by email.
  --user-id UUID       Backfill one user by id.
  --limit N            Max source items/chunks per pass. Default: 500.
  --batch-size N       Embedding batch size. Default: 16.
  --dimensions N       Embedding dimensions: 768 or 1536. Default: 768.
  --chunks-only        Create/update chunks without embedding them.
  --force              Rebuild chunks for selected items even if unchanged.
`);
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

async function ensureSchema(client: pg.Client): Promise<void> {
  for (const sql of AGENT_MEMORY_SCHEMA_SQL) {
    await client.query(sql);
  }
  for (const sql of AGENT_MEMORY_OPTIONAL_INDEX_SQL) {
    try {
      await client.query(sql);
    } catch (error) {
      console.warn(
        "[agent-memory] Optional HNSW index skipped:",
        error instanceof Error ? error.message : error
      );
    }
  }
}

async function resolveUserId(client: pg.Client, args: Args): Promise<string | undefined> {
  if (args.userId) return args.userId;
  if (!args.userEmail) return undefined;

  const result = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE lower(email) = lower($1)`,
    [args.userEmail]
  );
  if (result.rowCount !== 1) {
    throw new Error(`No unique user found for email: ${args.userEmail}`);
  }
  return result.rows[0].id;
}

async function fetchSourceItems(
  client: pg.Client,
  userId: string | undefined,
  limit: number,
  force: boolean
): Promise<SourceItemRow[]> {
  const params: unknown[] = [limit];
  const userClause = userId ? `AND ci.user_id = $2::uuid` : "";
  if (userId) params.push(userId);
  const unchangedClause = force
    ? ""
    : `AND NOT EXISTS (
        SELECT 1 FROM agent_memory_chunks amc
        WHERE amc.content_item_id = ci.id
          AND amc.content_hash = ci.content_hash
      )`;

  const result = await client.query<SourceItemRow>(
    `
      SELECT
        ci.id,
        ci.user_id,
        ci.source_type::text,
        ci.source_platform,
        ci.title,
        ci.body_text,
        ci.translated_title,
        ci.translated_body_text,
        ci.ai_summary,
        ci.prompt_text,
        ci.author_handle,
        ci.author_display_name,
        ci.original_url,
        ci.posted_at::text,
        ci.created_at::text,
        ci.content_hash,
        coalesce(array_remove(array_agg(DISTINCT t.name), NULL), '{}') AS tags,
        coalesce(array_remove(array_agg(DISTINCT c.name), NULL), '{}') AS categories,
        coalesce(array_remove(array_agg(DISTINCT m.ai_description), NULL), '{}') AS media_descriptions
      FROM content_items ci
      LEFT JOIN content_tags ct ON ct.content_item_id = ci.id
      LEFT JOIN tags t ON t.id = ct.tag_id
      LEFT JOIN content_categories cc ON cc.content_item_id = ci.id
      LEFT JOIN categories c ON c.id = cc.category_id
      LEFT JOIN media m ON m.content_item_id = ci.id
      WHERE ci.processing_status <> 'error'
        ${userClause}
        ${unchangedClause}
      GROUP BY ci.id
      ORDER BY ci.created_at DESC
      LIMIT $1
    `,
    params
  );

  return result.rows;
}

async function upsertChunks(client: pg.Client, items: SourceItemRow[], force: boolean): Promise<number> {
  let count = 0;

  for (const item of items) {
    if (force) {
      await client.query(`DELETE FROM agent_memory_chunks WHERE content_item_id = $1::uuid`, [item.id]);
    } else {
      await client.query(
        `DELETE FROM agent_memory_chunks WHERE content_item_id = $1::uuid AND content_hash <> $2`,
        [item.id, item.content_hash]
      );
    }

    const chunks = buildAgentMemoryChunks(item);
    for (const chunk of chunks) {
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO agent_memory_chunks (
            content_item_id,
            user_id,
            chunk_index,
            chunk_kind,
            chunk_text,
            title,
            source_url,
            source_platform,
            source_type,
            author_handle,
            author_display_name,
            posted_at,
            item_created_at,
            content_hash,
            metadata
          )
          VALUES (
            $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            $12::timestamptz, $13::timestamptz, $14, $15::jsonb
          )
          ON CONFLICT (content_item_id, chunk_kind, chunk_index)
          DO UPDATE SET
            chunk_text = EXCLUDED.chunk_text,
            title = EXCLUDED.title,
            source_url = EXCLUDED.source_url,
            source_platform = EXCLUDED.source_platform,
            source_type = EXCLUDED.source_type,
            author_handle = EXCLUDED.author_handle,
            author_display_name = EXCLUDED.author_display_name,
            posted_at = EXCLUDED.posted_at,
            item_created_at = EXCLUDED.item_created_at,
            content_hash = EXCLUDED.content_hash,
            metadata = EXCLUDED.metadata,
            updated_at = now()
          RETURNING id
        `,
        [
          chunk.content_item_id,
          chunk.user_id,
          chunk.chunk_index,
          chunk.chunk_kind,
          chunk.chunk_text,
          chunk.title,
          chunk.source_url,
          chunk.source_platform,
          chunk.source_type,
          chunk.author_handle,
          chunk.author_display_name,
          chunk.posted_at,
          chunk.item_created_at,
          chunk.content_hash,
          JSON.stringify(chunk.metadata),
        ]
      );
      await client.query(`SELECT agent_memory_refresh_chunk_search_vector($1::uuid)`, [
        result.rows[0].id,
      ]);
      count += 1;
    }
  }

  return count;
}

async function fetchChunksNeedingEmbeddings(
  client: pg.Client,
  userId: string | undefined,
  dimensions: 768 | 1536,
  limit: number
): Promise<ChunkRow[]> {
  const params: unknown[] = [dimensions, limit];
  const userClause = userId ? `AND c.user_id = $3::uuid` : "";
  if (userId) params.push(userId);

  const result = await client.query<ChunkRow>(
    `
      SELECT c.id, c.chunk_text, c.title, c.author_handle, c.author_display_name
      FROM agent_memory_chunks c
      LEFT JOIN agent_memory_embeddings e
        ON e.chunk_id = c.id
       AND e.dimensions = $1
      WHERE e.chunk_id IS NULL
        ${userClause}
      ORDER BY c.item_created_at DESC, c.chunk_index ASC
      LIMIT $2
    `,
    params
  );
  return result.rows;
}

async function embedChunks(
  client: pg.Client,
  chunks: ChunkRow[],
  dimensions: 768 | 1536,
  batchSize: number
): Promise<number> {
  const provider = getAiProviderLabel().toLowerCase();
  const model = getEmbeddingModelLabel();
  let count = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const inputs = batch.map((chunk) =>
      [chunk.title, chunk.author_handle, chunk.author_display_name, chunk.chunk_text]
        .filter(Boolean)
        .join("\n")
    );
    const embeddings = await generateEmbeddingsWithDimensions(inputs, dimensions);

    for (let j = 0; j < batch.length; j += 1) {
      const chunk = batch[j];
      const embedding = embeddings[j];
      if (embedding.length !== dimensions) {
        throw new Error(
          `Expected ${dimensions} dimensions but got ${embedding.length} for chunk ${chunk.id}`
        );
      }
      const column = dimensions === 1536 ? "embedding_1536" : "embedding_768";
      await client.query(
        `
          INSERT INTO agent_memory_embeddings (
            chunk_id,
            provider,
            model,
            dimensions,
            ${column}
          )
          VALUES ($1::uuid, $2, $3, $4, $5::vector)
          ON CONFLICT (chunk_id, dimensions)
          DO UPDATE SET
            provider = EXCLUDED.provider,
            model = EXCLUDED.model,
            ${column} = EXCLUDED.${column},
            embedded_at = now()
        `,
        [chunk.id, provider, model, dimensions, `[${embedding.join(",")}]`]
      );
      count += 1;
    }

    console.log(
      `[agent-memory] Embedded ${Math.min(i + batch.length, chunks.length)}/${chunks.length} chunks`
    );
  }

  return count;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = required(
    args.databaseUrl || process.env.DATABASE_URL,
    "Missing DATABASE_URL. Pass --database-url or set DATABASE_URL."
  );
  if (!databaseUrl.startsWith("postgres")) {
    throw new Error("Agent memory requires PostgreSQL or Supabase with pgvector.");
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await ensureSchema(client);
    const userId = await resolveUserId(client, args);
    const items = await fetchSourceItems(client, userId, args.limit, args.force);
    const chunksCreated = await upsertChunks(client, items, args.force);

    let chunksEmbedded = 0;
    if (args.embed) {
      if (!isAiConfigured()) {
        throw new Error(`${getAiProviderLabel()} API key is not configured.`);
      }
      const chunks = await fetchChunksNeedingEmbeddings(
        client,
        userId,
        args.dimensions,
        args.limit
      );
      chunksEmbedded = await embedChunks(client, chunks, args.dimensions, args.batchSize);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          source_items: items.length,
          chunks_created: chunksCreated,
          chunks_embedded: chunksEmbedded,
          dimensions: args.dimensions,
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
