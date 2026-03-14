import { getClient } from "@/lib/db/client";
import { getSearchProvider } from "@/lib/db/search-provider";
import { generateEmbedding, classifyContent, describeImage } from "@/lib/embeddings/gemini";
import { isR2Configured } from "@/lib/storage/r2";
import { downloadAndStoreMedia } from "@/lib/storage/download";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max for serverless

/**
 * Comprehensive backfill endpoint.
 * Processes all existing items that are missing AI classification data.
 *
 * Query params:
 *   ?scope=all       — Process everything (default)
 *   ?scope=classify  — Only AI classification (summary, tags, categories, prompts)
 *   ?scope=media     — Only media downloads + image descriptions
 *   ?scope=describe  — Only image descriptions (for already-downloaded media)
 *   ?scope=embed     — Only embeddings
 *   ?limit=50        — Max items to process per run (default 50)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") || "all";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 500);
  const mediaType = url.searchParams.get("type"); // optional: "image" or "video"

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream may be closed
        }
      };

      try {
        if (!process.env.GEMINI_API_KEY) {
          send({ error: "GEMINI_API_KEY not configured", done: true });
          controller.close();
          return;
        }

        const prisma = await getClient();
        let totalProcessed = 0;
        let totalErrors = 0;

        // --- Phase 1: AI Classification (summary, tags, categories, prompt detection) ---
        if (scope === "all" || scope === "classify") {
          send({ phase: "classify", status: "Finding items without AI summary..." });

          const items = await prisma.contentItem.findMany({
            where: { ai_summary: null },
            select: {
              id: true,
              title: true,
              body_text: true,
              source_type: true,
              author_handle: true,
            },
            take: limit,
            orderBy: { created_at: "desc" },
          });

          const total = items.length;
          send({ phase: "classify", total, status: `Processing ${total} items...` });

          const allCategories = await prisma.category.findMany({ select: { slug: true } });
          const categorySlugs = allCategories.map((c: { slug: string }) => c.slug);

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
              const classification = await classifyContent(
                item.title || "",
                item.body_text || "",
                item.source_type,
                categorySlugs,
                item.author_handle
              );

              // Update content item
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const updateData: Record<string, any> = {
                ai_summary: classification.ai_summary || null,
              };

              if (classification.has_prompt) {
                updateData.has_prompt = true;
                updateData.prompt_text = classification.prompt_text;
                if (classification.prompt_type) {
                  updateData.prompt_type = classification.prompt_type;
                }
                if (classification.prompt_type === "image" && item.source_type === "tweet") {
                  updateData.source_type = "image_prompt";
                } else if (classification.prompt_type === "video" && item.source_type === "tweet") {
                  updateData.source_type = "video_prompt";
                }
              }

              await prisma.contentItem.update({
                where: { id: item.id },
                data: updateData,
              });

              // Assign tags
              if (classification.tags.length > 0) {
                for (const name of classification.tags) {
                  try {
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    const tag = await prisma.tag.upsert({
                      where: { slug },
                      create: { name, slug },
                      update: {},
                    });
                    await prisma.contentTag.create({
                      data: { content_item_id: item.id, tag_id: tag.id },
                    });
                  } catch {
                    // Skip duplicates
                  }
                }
              }

              // Assign categories
              if (classification.category_slugs.length > 0) {
                for (const slug of classification.category_slugs) {
                  try {
                    const category = await prisma.category.findUnique({ where: { slug } });
                    if (category) {
                      await prisma.contentCategory.create({
                        data: { content_item_id: item.id, category_id: category.id },
                      });
                    }
                  } catch {
                    // Skip duplicates
                  }
                }
              }

              totalProcessed++;
            } catch (err) {
              totalErrors++;
              send({
                phase: "classify",
                progress: (i + 1) / total,
                error: `Item ${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
              });
            }

            send({
              phase: "classify",
              progress: (i + 1) / total,
              processed: i + 1,
              total,
              current: `Classified ${i + 1}/${total}`,
            });
          }
        }

        // --- Phase 2: Embeddings ---
        if (scope === "all" || scope === "embed") {
          send({ phase: "embed", status: "Finding items without embeddings..." });

          // Raw query to find items without embeddings
          const provider = await getSearchProvider();
          const unembedded: Array<{ id: string; title: string; body_text: string; author_handle: string | null; author_display_name: string | null }> =
            await prisma.$queryRawUnsafe(
              `SELECT id, title, body_text, author_handle, author_display_name
               FROM content_items WHERE embedding IS NULL LIMIT $1`,
              limit
            );

          const total = unembedded.length;
          send({ phase: "embed", total, status: `Embedding ${total} items...` });

          for (let i = 0; i < unembedded.length; i++) {
            const item = unembedded[i];
            try {
              const text = [item.title, item.body_text, item.author_handle, item.author_display_name]
                .filter(Boolean)
                .join(" ");
              const embedding = await generateEmbedding(text);
              await provider.writeEmbedding(item.id, embedding);

              // Also update tsvector while we're at it
              const authorParts = [item.author_handle, item.author_display_name].filter(Boolean).join(" ");
              await provider.updateSearchVector(item.id, {
                title: item.title || "",
                body: item.body_text || "",
                author: authorParts || undefined,
              });

              await prisma.contentItem.update({
                where: { id: item.id },
                data: { processing_status: "indexed" },
              });

              totalProcessed++;
            } catch (err) {
              totalErrors++;
              send({
                phase: "embed",
                error: `Item ${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
              });
            }

            send({
              phase: "embed",
              progress: (i + 1) / total,
              processed: i + 1,
              total,
              current: `Embedded ${i + 1}/${total}`,
            });
          }
        }

        // --- Phase 3: Media downloads ---
        if ((scope === "all" || scope === "media") && isR2Configured()) {
          send({ phase: "media", status: "Finding media without R2 storage..." });

          // Process images first (fast), then videos (slow)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const whereClause: Record<string, any> = { stored_path: null };
          if (mediaType) whereClause.media_type = mediaType;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mediaItems = await (prisma as any).media.findMany({
            where: whereClause,
            select: { id: true, content_item_id: true, original_url: true, media_type: true },
            take: limit,
            orderBy: { media_type: "asc" }, // gif, image, video — images before videos
          });

          const total = mediaItems.length;
          send({ phase: "media", total, status: `Downloading ${total} media items...` });

          for (let i = 0; i < mediaItems.length; i++) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const m = mediaItems[i] as any;
            try {
              const storedPath = await downloadAndStoreMedia(m.id, m.content_item_id, m.original_url);
              if (storedPath) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (prisma as any).media.update({
                  where: { id: m.id },
                  data: { stored_path: storedPath },
                });
              }
              totalProcessed++;
            } catch {
              totalErrors++;
            }

            send({
              phase: "media",
              progress: (i + 1) / total,
              processed: i + 1,
              total,
              current: `Downloaded ${i + 1}/${total}`,
            });
          }
        }

        // --- Phase 4: Image descriptions ---
        if (scope === "all" || scope === "describe" || scope === "media") {
          send({ phase: "describe", status: "Finding images without descriptions..." });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const images = await (prisma as any).media.findMany({
            where: {
              ai_description: null,
              stored_path: { not: null },
              media_type: "image",
            },
            select: { id: true, stored_path: true, original_url: true },
            take: limit,
          });

          const total = images.length;
          send({ phase: "describe", total, status: `Describing ${total} images...` });

          for (let i = 0; i < images.length; i++) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const img = images[i] as any;
            try {
              // Use original URL directly — avoids localhost proxy issues
              const description = await describeImage(img.original_url);

              if (description.alt_text || description.ai_description) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (prisma as any).media.update({
                  where: { id: img.id },
                  data: {
                    alt_text: description.alt_text || undefined,
                    ai_description: description.ai_description || undefined,
                  },
                });
              }
              totalProcessed++;
            } catch (err) {
              totalErrors++;
              send({
                phase: "describe",
                error: `Image ${img.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
              });
            }

            send({
              phase: "describe",
              progress: (i + 1) / total,
              processed: i + 1,
              total,
              current: `Described ${i + 1}/${total}`,
            });
          }
        }

        send({
          done: true,
          totalProcessed,
          totalErrors,
          summary: `Backfill complete. Processed: ${totalProcessed}, Errors: ${totalErrors}`,
        });
      } catch (err) {
        send({
          error: err instanceof Error ? err.message : "Backfill failed",
          done: true,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
