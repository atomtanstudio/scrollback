import { getClient, getDatabaseType } from "@/lib/db/client";
import {
  AGENT_MEMORY_OPTIONAL_INDEX_SQL,
  AGENT_MEMORY_SCHEMA_SQL,
} from "@/lib/agent-memory/schema";

export type AgentMemorySearchMode = "keyword" | "vector" | "hybrid";
export type AgentMemoryDimensions = 768 | 1536;

export type AgentMemorySearchResult = {
  chunk_id: string;
  content_item_id: string;
  title: string;
  chunk_text: string;
  source_url: string | null;
  author_handle: string | null;
  author_display_name: string | null;
  source_type: string;
  posted_at: string | null;
  score: number;
  keyword_score?: number;
  vector_score?: number;
};

export async function ensureAgentMemorySchema(): Promise<void> {
  const dbType = getDatabaseType();
  if (dbType === "sqlite") {
    throw new Error("Agent memory search requires PostgreSQL or Supabase with pgvector.");
  }

  const prisma = await getClient();
  for (const sql of AGENT_MEMORY_SCHEMA_SQL) {
    await prisma.$executeRawUnsafe(sql);
  }

  for (const sql of AGENT_MEMORY_OPTIONAL_INDEX_SQL) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (error) {
      console.warn(
        "[agent-memory] Optional HNSW index could not be created:",
        error instanceof Error ? error.message : error
      );
    }
  }
}

function vectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.min(200, Math.max(1, Math.floor(limit || 20)));
}

export async function searchAgentMemory(options: {
  userId: string;
  query: string;
  mode?: AgentMemorySearchMode;
  dimensions?: AgentMemoryDimensions;
  embedding?: number[];
  limit?: number;
  keywordWeight?: number;
  vectorWeight?: number;
}): Promise<AgentMemorySearchResult[]> {
  const mode = options.mode || "hybrid";
  const dimensions = options.dimensions || 768;
  const limit = normalizeLimit(options.limit);
  const prisma = await getClient();

  if (mode === "keyword") {
    return prisma.$queryRawUnsafe(
      `SELECT * FROM agent_memory_keyword_search($1::uuid, $2::text, $3::integer)`,
      options.userId,
      options.query,
      limit
    );
  }

  if (!options.embedding || options.embedding.length !== dimensions) {
    throw new Error(`A ${dimensions}-dimension embedding is required for ${mode} search.`);
  }

  const vector = vectorLiteral(options.embedding);
  if (mode === "vector") {
    const fn =
      dimensions === 1536
        ? "agent_memory_vector_search_1536"
        : "agent_memory_vector_search_768";
    return prisma.$queryRawUnsafe(
      `SELECT * FROM ${fn}($1::uuid, $2::vector, $3::integer)`,
      options.userId,
      vector,
      limit
    );
  }

  const fn =
    dimensions === 1536
      ? "agent_memory_hybrid_search_1536"
      : "agent_memory_hybrid_search_768";
  return prisma.$queryRawUnsafe(
    `SELECT * FROM ${fn}($1::uuid, $2::text, $3::vector, $4::integer, $5::double precision, $6::double precision)`,
    options.userId,
    options.query,
    vector,
    limit,
    options.keywordWeight ?? 0.45,
    options.vectorWeight ?? 0.55
  );
}
