import { getClient } from "@/lib/db/client";
import { isR2Configured } from "@/lib/storage/r2";
import { downloadAndStoreMedia } from "@/lib/storage/download";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
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
        if (!isR2Configured()) {
          send({ error: "R2 storage is not configured. Set R2_* environment variables.", done: true });
          controller.close();
          return;
        }

        const prisma = await getClient();

        const url = new URL(request.url);
        const forceAll = url.searchParams.get("force") === "true";

        // Skip videos — they're too large to buffer in memory
        const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
        const isVideoUrl = (u: string) => {
          const path = u.split("?")[0].toLowerCase();
          return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext)) || path.includes("/vid/");
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allMedia = await (prisma as any).media.findMany({
          where: forceAll ? {} : { stored_path: null },
          select: { id: true, content_item_id: true, original_url: true, media_type: true },
          take: 1000,
        });

        const mediaItems = allMedia.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (m: any) => m.media_type !== "video" && !isVideoUrl(m.original_url)
        );

        const total = mediaItems.length;
        if (total === 0) {
          send({ progress: 1, processed: 0, total: 0, current: "All media already stored", done: true });
          controller.close();
          return;
        }

        let processed = 0;

        for (const item of mediaItems) {
          if (cancelled) break;

          try {
            const storedUrl = await downloadAndStoreMedia(
              item.id,
              item.content_item_id,
              item.original_url
            );

            if (storedUrl) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (prisma as any).media.update({
                where: { id: item.id },
                data: { stored_path: storedUrl },
              });
            }
          } catch {
            // Skip failed downloads, continue with next
          }

          processed++;
          send({
            progress: processed / total,
            processed,
            total,
            current: `Downloading media ${processed}/${total}`,
          });
        }

        if (!cancelled) {
          send({ progress: 1, processed, total, done: true });
        }
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
