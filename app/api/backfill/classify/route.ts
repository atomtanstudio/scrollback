import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getClient } from "@/lib/db/client";
import { getSearchProvider } from "@/lib/db/search-provider";
import { generateEmbedding, classifyContent, describeImage, translateToEnglish, isAiConfigured, supportsEmbeddings } from "@/lib/embeddings";
import { isR2Configured } from "@/lib/storage/r2";
import { downloadAndStoreMedia } from "@/lib/storage/download";
import { qualifiesAsArtCapture } from "@/lib/art-detection";
import { needsRetranslation, originalLooksLikeForeignText } from "@/lib/translation-backfill";
import { getCategoryOptions } from "@/lib/default-categories";

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
 *   ?scope=translate — Re-translate non-English items with updated limits
 *   ?scope=reclassify — Re-run AI classification on ALL items (clears old tags first)
 *   ?limit=50        — Max items to process per run (default 50)
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") || "all";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 500);
  const mediaType = url.searchParams.get("type"); // optional: "image" or "video"

  const encoder = new TextEncoder();
  let cancelled = false;

  request.signal.addEventListener("abort", () => {
    cancelled = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          cancelled = true;
        }
      };

      try {
        if (!isAiConfigured()) {
          send({ error: "AI provider API key not configured", done: true });
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

          const categoryOptions = await getCategoryOptions(prisma);

          for (let i = 0; i < items.length; i++) {
            if (cancelled) break;
            const item = items[i];
            try {
              const classification = await classifyContent(
                item.title || "",
                item.body_text || "",
                item.source_type,
                categoryOptions,
                item.author_handle
              );

              // Update content item
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const updateData: Record<string, any> = {
                ai_summary: classification.ai_summary || null,
              };

              const canPromoteToArt =
                classification.confidence >= 0.7 &&
                qualifiesAsArtCapture({
                  title: item.title,
                  bodyText: item.body_text,
                  promptText: classification.prompt_text,
                  promptType: classification.prompt_type,
                  hasVideo: item.source_type === "video_prompt",
                });

              if (classification.has_prompt) {
                updateData.has_prompt = true;
                updateData.prompt_text = classification.prompt_text;
                if (classification.prompt_type) {
                  updateData.prompt_type = classification.prompt_type;
                }
                // Only upgrade source_type with high confidence
                if (canPromoteToArt) {
                  if (classification.prompt_type === "image" && item.source_type === "tweet") {
                    updateData.source_type = "image_prompt";
                  } else if (classification.prompt_type === "video" && item.source_type === "tweet") {
                    updateData.source_type = "video_prompt";
                  }
                }
              }

              await prisma.contentItem.update({
                where: { id: item.id },
                data: updateData,
              });

              // Assign tags (batched)
              if (classification.tags.length > 0) {
                const tags = await Promise.all(
                  classification.tags.map(async (name) => {
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    try {
                      return await prisma.tag.upsert({
                        where: { slug },
                        create: { name, slug },
                        update: {},
                      });
                    } catch { return null; }
                  })
                );
                const validTags = tags.filter((t): t is NonNullable<typeof t> => t !== null);
                if (validTags.length > 0) {
                  await prisma.contentTag.createMany({
                    data: validTags.map((tag) => ({ content_item_id: item.id, tag_id: tag.id })),
                    skipDuplicates: true,
                  }).catch(() => {});
                }
              }

              // Assign categories (batched)
              if (classification.category_slugs.length > 0) {
                const cats = await prisma.category.findMany({
                  where: { slug: { in: classification.category_slugs } },
                  select: { id: true },
                });
                if (cats.length > 0) {
                  await prisma.contentCategory.createMany({
                    data: cats.map((cat: { id: string }) => ({ content_item_id: item.id, category_id: cat.id })),
                    skipDuplicates: true,
                  }).catch(() => {});
                }
              }

              totalProcessed++;
            } catch (err) {
              totalErrors++;
              send({
                phase: "classify",
                progress: (i + 1) / total,
                warning: `Item ${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
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

        // --- Phase 1b: Reclassify ALL items (clear old tags, re-run AI) ---
        if (scope === "reclassify") {
          send({ phase: "reclassify", status: "Finding items to reclassify..." });

          const items = await prisma.contentItem.findMany({
            where: { ai_summary: { not: null } },
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
          send({ phase: "reclassify", total, status: `Reclassifying ${total} items...` });

          const categoryOptions = await getCategoryOptions(prisma);

          for (let i = 0; i < items.length; i++) {
            if (cancelled) break;
            const item = items[i];
            try {
              // Clear old tags and categories for this item
              await prisma.contentTag.deleteMany({ where: { content_item_id: item.id } });
              await prisma.contentCategory.deleteMany({ where: { content_item_id: item.id } });

              const classification = await classifyContent(
                item.title || "",
                item.body_text || "",
                item.source_type,
                categoryOptions,
                item.author_handle
              );

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
              }

              await prisma.contentItem.update({
                where: { id: item.id },
                data: updateData,
              });

              // Assign new tags (batched)
              if (classification.tags.length > 0) {
                const tags = await Promise.all(
                  classification.tags.map(async (name) => {
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    try {
                      return await prisma.tag.upsert({
                        where: { slug },
                        create: { name, slug },
                        update: {},
                      });
                    } catch { return null; }
                  })
                );
                const validTags = tags.filter((t): t is NonNullable<typeof t> => t !== null);
                if (validTags.length > 0) {
                  await prisma.contentTag.createMany({
                    data: validTags.map((tag) => ({ content_item_id: item.id, tag_id: tag.id })),
                    skipDuplicates: true,
                  }).catch(() => {});
                }
              }

              // Assign new categories (batched)
              if (classification.category_slugs.length > 0) {
                const cats = await prisma.category.findMany({
                  where: { slug: { in: classification.category_slugs } },
                  select: { id: true },
                });
                if (cats.length > 0) {
                  await prisma.contentCategory.createMany({
                    data: cats.map((cat: { id: string }) => ({ content_item_id: item.id, category_id: cat.id })),
                    skipDuplicates: true,
                  }).catch(() => {});
                }
              }

              totalProcessed++;
            } catch (err) {
              totalErrors++;
              send({
                phase: "reclassify",
                progress: (i + 1) / total,
                warning: `Item ${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
              });
            }

            send({
              phase: "reclassify",
              progress: (i + 1) / total,
              processed: i + 1,
              total,
              current: `Reclassified ${i + 1}/${total}`,
            });
          }
        }

        // --- Phase 2: Embeddings ---
        if (scope === "all" || scope === "embed") {
          if (!supportsEmbeddings()) {
            send({
              phase: "embed",
              progress: 1,
              processed: 0,
              total: 0,
              current: "Skipped embeddings: selected AI provider does not support embeddings",
            });
          } else {
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
              if (cancelled) break;
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
                  warning: `Item ${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
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
            if (cancelled) break;
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
            if (cancelled) break;
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
                warning: `Image ${img.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
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

        // --- Phase 5: Re-translate non-English items ---
        if (scope === "translate") {
          send({ phase: "translate", status: "Finding non-English items to re-translate..." });

          const items = await prisma.contentItem.findMany({
            where: {
              OR: [
                {
                  language: { not: null },
                  NOT: { language: "en" },
                },
                {
                  translated_body_text: null,
                },
              ],
            },
            select: {
              id: true,
              title: true,
              body_text: true,
              language: true,
              translated_title: true,
              translated_body_text: true,
            },
            orderBy: { created_at: "desc" },
            take: Math.min(limit * 5, 2000),
          });

          const eligibleItems = items.filter((item: {
            id: string;
            title: string | null;
            body_text: string;
            language: string | null;
            translated_title: string | null;
            translated_body_text: string | null;
          }) =>
            item.language?.toLowerCase() !== "en" || originalLooksLikeForeignText(item.title, item.body_text)
          );
          const queue = eligibleItems.filter((item: {
            id: string;
            title: string | null;
            body_text: string;
            language: string | null;
            translated_title: string | null;
            translated_body_text: string | null;
          }) => needsRetranslation(item)).slice(0, limit);

          const total = queue.length;
          send({
            phase: "translate",
            total,
            status: `Re-translating ${total} items...`,
            current: `Found ${queue.length} items to retry out of ${eligibleItems.length} likely foreign-language items`,
          });

          for (let i = 0; i < queue.length; i++) {
            if (cancelled) break;
            const item = queue[i];
            try {
              const translation = await translateToEnglish(item.title, item.body_text);

              if (translation.translated) {
                await prisma.contentItem.update({
                  where: { id: item.id },
                  data: {
                    language: translation.language,
                    translated_title: translation.translated_title,
                    translated_body_text: translation.translated_body_text,
                  },
                });
              }

              totalProcessed++;
            } catch (err) {
              totalErrors++;
              send({
                phase: "translate",
                warning: `Item ${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
              });
            }

            send({
              phase: "translate",
              progress: (i + 1) / total,
              processed: i + 1,
              total,
              current: `Translated ${i + 1}/${total}`,
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
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      cancelled = true;
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
