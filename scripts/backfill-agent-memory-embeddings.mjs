#!/usr/bin/env node

import pg from "pg";

const DEFAULT_BASE_URL = "http://127.0.0.1:8001/v1";
const DEFAULT_MODEL = "Qwen/Qwen3-Embedding-4B";

function parseArgs(argv) {
  const args = {
    dimensions: 1536,
    limit: 500,
    batchSize: 4,
    untilDone: false,
    baseUrl: process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY || "local",
    model: process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_MODEL,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--dimensions") {
      args.dimensions = Number.parseInt(next || "", 10);
      i += 1;
    } else if (arg === "--limit") {
      args.limit = Number.parseInt(next || "", 10);
      i += 1;
    } else if (arg === "--batch-size") {
      args.batchSize = Number.parseInt(next || "", 10);
      i += 1;
    } else if (arg === "--base-url") {
      args.baseUrl = next;
      i += 1;
    } else if (arg === "--api-key") {
      args.apiKey = next;
      i += 1;
    } else if (arg === "--model") {
      args.model = next;
      i += 1;
    } else if (arg === "--until-done") {
      args.untilDone = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (args.dimensions !== 768 && args.dimensions !== 1536) {
    throw new Error("--dimensions must be 768 or 1536");
  }
  if (!Number.isInteger(args.limit) || args.limit < 1) {
    throw new Error("--limit must be a positive integer");
  }
  if (!Number.isInteger(args.batchSize) || args.batchSize < 1) {
    throw new Error("--batch-size must be a positive integer");
  }
  return args;
}

function printHelp() {
  console.log(`
Backfill missing agent_memory_embeddings rows from an OpenAI-compatible service.

Usage:
  node scripts/backfill-agent-memory-embeddings.mjs \\
    --dimensions 1536 \\
    --base-url http://192.168.1.102:8001/v1 \\
    --until-done

Options:
  --dimensions N       Embedding dimensions: 768 or 1536. Default: 1536.
  --limit N            Chunks to process per pass. Default: 500.
  --batch-size N       Embeddings per request. Default: 4.
  --base-url URL       OpenAI-compatible base URL. Default: OPENAI_BASE_URL.
  --api-key KEY        Authorization bearer token. Default: OPENAI_API_KEY or local.
  --model NAME         Embedding model name.
  --until-done         Keep running passes until no chunks remain.
`);
}

function embeddingsUrl(baseUrl) {
  const clean = baseUrl.replace(/\/+$/, "");
  return clean.endsWith("/v1") ? `${clean}/embeddings` : `${clean}/v1/embeddings`;
}

function chunkInput(chunk) {
  return [
    chunk.title,
    chunk.author_handle,
    chunk.author_display_name,
    chunk.chunk_text,
  ]
    .filter(Boolean)
    .join("\n");
}

async function fetchChunks(client, dimensions, limit) {
  const result = await client.query(
    `
      SELECT c.id, c.chunk_text, c.title, c.author_handle, c.author_display_name
      FROM agent_memory_chunks c
      LEFT JOIN agent_memory_embeddings e
        ON e.chunk_id = c.id
       AND e.dimensions = $1
      WHERE e.chunk_id IS NULL
      ORDER BY c.item_created_at DESC, c.chunk_index ASC
      LIMIT $2
    `,
    [dimensions, limit]
  );
  return result.rows;
}

async function embedBatch(args, chunks) {
  const response = await fetch(embeddingsUrl(args.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      input: chunks.map(chunkInput),
      dimensions: args.dimensions,
      input_type: "document",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Embedding service returned ${response.status}: ${text.slice(0, 500)}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.data)) {
    throw new Error("Embedding service response did not include data[]");
  }

  return payload.data
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((item, index) => {
      if (!Array.isArray(item.embedding)) {
        throw new Error(`Embedding ${index} is missing`);
      }
      if (item.embedding.length !== args.dimensions) {
        throw new Error(
          `Expected ${args.dimensions} dimensions but got ${item.embedding.length}`
        );
      }
      if (!item.embedding.every(Number.isFinite)) {
        throw new Error(`Embedding ${index} includes a non-finite value`);
      }
      return item.embedding;
    });
}

async function saveEmbedding(client, args, chunkId, embedding) {
  const column = args.dimensions === 1536 ? "embedding_1536" : "embedding_768";
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
    [chunkId, "openai-compatible", args.model, args.dimensions, `[${embedding.join(",")}]`]
  );
}

async function processPass(client, args) {
  const chunks = await fetchChunks(client, args.dimensions, args.limit);
  let count = 0;

  for (let i = 0; i < chunks.length; i += args.batchSize) {
    const batch = chunks.slice(i, i + args.batchSize);
    const embeddings = await embedBatch(args, batch);

    for (let j = 0; j < batch.length; j += 1) {
      await saveEmbedding(client, args, batch[j].id, embeddings[j]);
      count += 1;
    }

    console.log(
      `[agent-memory] Embedded ${Math.min(i + batch.length, chunks.length)}/${chunks.length} chunks this pass`
    );
  }

  return count;
}

async function countCoverage(client) {
  const result = await client.query(
    `
      SELECT
        (SELECT count(*)::integer FROM agent_memory_chunks) AS chunks,
        count(*) FILTER (WHERE dimensions = 768)::integer AS embedded_768,
        count(*) FILTER (WHERE dimensions = 1536)::integer AS embedded_1536
      FROM agent_memory_embeddings
    `
  );
  return result.rows[0];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL");
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    let total = 0;
    let passes = 0;
    while (true) {
      passes += 1;
      const processed = await processPass(client, args);
      total += processed;
      if (!args.untilDone || processed === 0) break;
    }

    const coverage = await countCoverage(client);
    console.log(
      JSON.stringify(
        {
          ok: true,
          dimensions: args.dimensions,
          passes,
          chunks_embedded: total,
          coverage,
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
