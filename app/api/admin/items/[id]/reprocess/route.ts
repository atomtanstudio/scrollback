import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getClient } from "@/lib/db/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const db = await getClient();

  const item = await db.contentItem.findUnique({
    where: { id },
    select: {
      id: true, body_text: true, title: true, author_handle: true,
      source_type: true,
      categories: { select: { category: { select: { slug: true } } } },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Fire and forget — runs in background
  (async () => {
    try {
      const text = `${item.title || ""} ${item.body_text || ""}`.trim();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const categorySlugs = item.categories?.map((c: any) => c.category.slug) || [];

      // 1. Re-classify via Gemini (summary, tags, categories)
      const { classifyContent } = await import("@/lib/embeddings/gemini");
      const result = await classifyContent(
        item.title || "",
        item.body_text || "",
        item.source_type,
        categorySlugs,
        item.author_handle
      );
      if (result) {
        await db.contentItem.update({
          where: { id },
          data: { ai_summary: result.ai_summary },
        });
      }

      // 2. Regenerate search vector
      await db.$queryRawUnsafe(
        `UPDATE content_items SET search_vector = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body_text,'') || ' ' || coalesce(author_handle,'')) WHERE id = $1::uuid`,
        id
      );

      // 3. Regenerate embedding
      const { generateEmbedding } = await import("@/lib/embeddings/gemini");
      const embedding = await generateEmbedding(text);
      if (embedding) {
        const vectorStr = `[${embedding.join(",")}]`;
        await db.$queryRawUnsafe(
          `UPDATE content_items SET embedding = $1::vector WHERE id = $2::uuid`,
          vectorStr,
          id
        );
      }

      console.log(`Reprocessed item ${id}`);
    } catch (err) {
      console.error(`Reprocess failed for ${id}:`, err);
    }
  })();

  return NextResponse.json({ success: true, message: "Reprocessing started" });
}
