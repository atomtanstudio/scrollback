import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getClient } from "@/lib/db/client";
import { classifyContent } from "@/lib/embeddings/gemini";
import { qualifiesAsArtCapture } from "@/lib/art-detection";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Reclassify art items to fix false positives.
 * Re-evaluates all image_prompt/video_prompt items using the improved Gemini prompt.
 * Items that aren't actually art prompts get downgraded back to "tweet".
 *
 * Query params:
 *   ?limit=50    — Max items per run (default 50, max 500)
 *   ?dry_run=1   — Preview changes without writing to DB
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 500);
  const dryRun = url.searchParams.get("dry_run") === "1";

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
        if (!process.env.GEMINI_API_KEY) {
          send({ error: "GEMINI_API_KEY not configured", done: true });
          controller.close();
          return;
        }

        const prisma = await getClient();

        // Find art items to re-evaluate
        const items = await prisma.contentItem.findMany({
          where: { source_type: { in: ["image_prompt", "video_prompt"] } },
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
        send({ status: `Re-evaluating ${total} art items${dryRun ? " (DRY RUN)" : ""}...`, total });

        const allCategories = await prisma.category.findMany({ select: { slug: true } });
        const categorySlugs = allCategories.map((c: { slug: string }) => c.slug);

        let downgraded = 0;
        let kept = 0;
        let errors = 0;

        for (let i = 0; i < items.length; i++) {
          if (cancelled) break;

          const item = items[i];
          try {
            const classification = await classifyContent(
              item.title || "",
              item.body_text || "",
              item.source_type,
              categorySlugs,
              item.author_handle
            );

            const isLegitArt =
              qualifiesAsArtCapture({
                title: item.title,
                bodyText: item.body_text,
                promptText: classification.prompt_text,
                promptType: classification.prompt_type,
                hasVideo: item.source_type === "video_prompt",
              });

            if (!isLegitArt) {
              downgraded++;
              const bodyPreview = (item.body_text || "").slice(0, 100);
              send({
                action: "downgrade",
                id: item.id,
                from: item.source_type,
                to: "tweet",
                confidence: classification.confidence,
                has_prompt: classification.has_prompt,
                prompt_type: classification.prompt_type,
                body_preview: bodyPreview,
              });

              if (!dryRun) {
                await prisma.contentItem.update({
                  where: { id: item.id },
                  data: {
                    source_type: "tweet",
                    has_prompt: classification.has_prompt || false,
                    prompt_text: classification.prompt_text,
                    prompt_type: classification.prompt_type,
                  },
                });
              }
            } else {
              kept++;
            }
          } catch (err) {
            errors++;
            send({
              error: `Item ${item.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
            });
          }

          send({
            progress: (i + 1) / total,
            processed: i + 1,
            total,
            downgraded,
            kept,
            errors,
          });
        }

        if (!cancelled) {
          send({
            done: true,
            summary: `${dryRun ? "[DRY RUN] " : ""}Processed: ${total}, Downgraded: ${downgraded}, Kept as art: ${kept}, Errors: ${errors}`,
            downgraded,
            kept,
            errors,
          });
        }
      } catch (err) {
        send({
          error: err instanceof Error ? err.message : "Reclassification failed",
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
