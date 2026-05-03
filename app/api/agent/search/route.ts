import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureAgentMemorySchema, searchAgentMemory } from "@/lib/agent-memory/db";
import { requireApiAccess } from "@/lib/auth/api-access";
import { generateEmbeddingWithDimensions } from "@/lib/embeddings";

export const dynamic = "force-dynamic";

const searchSchema = z.object({
  query: z.string().min(1).max(1000),
  mode: z.enum(["keyword", "vector", "hybrid"]).default("hybrid"),
  dimensions: z.union([z.literal(768), z.literal(1536)]).default(768),
  limit: z.number().int().min(1).max(200).default(20),
  keywordWeight: z.number().min(0).max(1).optional(),
  vectorWeight: z.number().min(0).max(1).optional(),
});

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(request);
  if (!access.ok) return access.response;

  const parsed = searchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { query, mode, dimensions, limit, keywordWeight, vectorWeight } = parsed.data;

  try {
    await ensureAgentMemorySchema();
    const embedding =
      mode === "keyword"
        ? undefined
        : await generateEmbeddingWithDimensions(query, dimensions);

    const results = await searchAgentMemory({
      userId: access.userId,
      query,
      mode,
      dimensions,
      embedding,
      limit,
      keywordWeight,
      vectorWeight,
    });

    return NextResponse.json(
      {
        results,
        query,
        mode,
        dimensions,
        limit,
        auth_method: access.authMethod,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent search failed" },
      { status: 500 }
    );
  }
}
