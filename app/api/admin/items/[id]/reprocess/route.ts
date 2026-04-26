import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { getClient } from "@/lib/db/client";
import { getCategoryOptions } from "@/lib/default-categories";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
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

      let language: string | null = null;
      let translatedTitle: string | null = null;
      let translatedBodyText: string | null = null;
      let englishTitle = item.title || "";
      let englishBody = item.body_text || "";

      const { isAiConfigured } = await import("@/lib/embeddings");
      const aiConfigured = isAiConfigured();

      if (aiConfigured) {
        try {
          const { translateToEnglish } = await import("@/lib/embeddings");
          const translation = await translateToEnglish(item.title || "", item.body_text || "");
          language = translation.language;
          translatedTitle = translation.translated_title;
          translatedBodyText = translation.translated_body_text;
          if (translatedTitle) englishTitle = translatedTitle;
          if (translatedBodyText) englishBody = translatedBodyText;
        } catch (translationErr) {
          console.warn(`Reprocess translation failed for ${id}:`, translationErr);
        }
      }

      const text = `${englishTitle} ${englishBody}`.trim();
      const categoryOptions = await getCategoryOptions(db);

      // 1. Re-classify via the configured AI provider (summary, tags, categories)
      if (aiConfigured) {
        const { classifyContent } = await import("@/lib/embeddings");
        const result = await classifyContent(
          englishTitle,
          englishBody,
          resolvedSourceType,
          categoryOptions,
          item.author_handle
        );
        // Clear old tags and categories
        await db.contentTag.deleteMany({ where: { content_item_id: id } });
        await db.contentCategory.deleteMany({ where: { content_item_id: id } });

        // Update summary and prompt data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = {
          ai_summary: result.ai_summary,
          language,
          translated_title: translatedTitle,
          translated_body_text: translatedBodyText,
        };
        if (result.has_prompt) {
          updateData.has_prompt = true;
          updateData.prompt_text = result.prompt_text;
          if (result.prompt_type) updateData.prompt_type = result.prompt_type;
        }
        await db.contentItem.update({ where: { id }, data: updateData });

        // Assign new tags
        if (result.tags.length > 0) {
          const tags = await Promise.all(
            result.tags.map(async (name: string) => {
              const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
              try {
                return await db.tag.upsert({
                  where: { slug },
                  create: { name, slug },
                  update: {},
                });
              } catch { return null; }
            })
          );
          const validTags = tags.filter((t): t is NonNullable<typeof t> => t !== null);
          if (validTags.length > 0) {
            await db.contentTag.createMany({
              data: validTags.map((tag) => ({ content_item_id: id, tag_id: tag.id })),
              skipDuplicates: true,
            }).catch(() => {});
          }
        }

        // Assign new categories
        if (result.category_slugs.length > 0) {
          const cats = await db.category.findMany({
            where: { slug: { in: result.category_slugs } },
            select: { id: true },
          });
          if (cats.length > 0) {
            await db.contentCategory.createMany({
              data: cats.map((cat: { id: string }) => ({ content_item_id: id, category_id: cat.id })),
              skipDuplicates: true,
            }).catch(() => {});
          }
        }
      }

      // 2. Regenerate search vector
      await db.$queryRawUnsafe(
        `UPDATE content_items
         SET search_vector = to_tsvector('english', coalesce($1,'') || ' ' || coalesce($2,'') || ' ' || coalesce(author_handle,''))
         WHERE id = $3::uuid`,
        englishTitle,
        englishBody,
        id
      );

      // 3. Regenerate embedding
      if (aiConfigured) {
        const { generateEmbedding, supportsEmbeddings } = await import("@/lib/embeddings");
        if (!supportsEmbeddings()) {
          console.log(`Skipped embedding regeneration for ${id}: provider does not support embeddings`);
        } else {
          const embedding = await generateEmbedding(text);
          if (embedding) {
            const vectorStr = `[${embedding.join(",")}]`;
            await db.$queryRawUnsafe(
              `UPDATE content_items SET embedding = $1::vector WHERE id = $2::uuid`,
              vectorStr,
              id
            );
          }
        }
      }

      console.log(`Reprocessed item ${id}`);
    } catch (err) {
      console.error(`Reprocess failed for ${id}:`, err);
    }
  })();

  return NextResponse.json({ success: true, message: "Reprocessing started" });
}
