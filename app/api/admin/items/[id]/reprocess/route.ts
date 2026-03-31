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

  const targetUserId = request.nextUrl.searchParams.get("userId");
  const ownerFilter =
    session.user.role === "admin" && targetUserId ? targetUserId : session.user.id;
  const item = await db.contentItem.findFirst({
    where: { id, user_id: ownerFilter },
    select: {
      id: true, body_text: true, title: true, author_handle: true,
      conversation_id: true,
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
      let resolvedSourceType = item.source_type;
      if (
        item.author_handle &&
        item.conversation_id &&
        (item.source_type === "tweet" || item.source_type === "thread")
      ) {
        const siblingCount = await db.contentItem.count({
          where: {
            conversation_id: item.conversation_id,
            author_handle: item.author_handle,
            source_type: { not: "article" },
          },
        });

        resolvedSourceType = siblingCount >= 2 ? "thread" : "tweet";
        if (resolvedSourceType !== item.source_type) {
          await db.contentItem.update({
            where: { id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { source_type: resolvedSourceType as any },
          });
        }
      }

      const text = `${item.title || ""} ${item.body_text || ""}`.trim();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const categorySlugs = item.categories?.map((c: any) => c.category.slug) || [];

      // 1. Re-classify via Gemini (summary, tags, categories)
      const { classifyContent } = await import("@/lib/embeddings/gemini");
      const result = await classifyContent(
        item.title || "",
        item.body_text || "",
        resolvedSourceType,
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
