import { getClient } from "@/lib/db/client";
import { isR2Configured } from "@/lib/storage/r2";
import { downloadAndStoreMedia } from "@/lib/storage/download";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        if (!isR2Configured()) {
          send({ error: "R2 storage is not configured. Set R2_* environment variables.", done: true });
          controller.close();
          return;
        }

        const prisma = await getClient();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mediaItems = await (prisma as any).media.findMany({
          where: { stored_path: null },
          select: { id: true, content_item_id: true, original_url: true },
        });

        const total = mediaItems.length;
        if (total === 0) {
          send({ progress: 1, processed: 0, total: 0, current: "All media already stored", done: true });
          controller.close();
          return;
        }

        let processed = 0;

        for (const item of mediaItems) {
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

        send({ progress: 1, processed, total, done: true });
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
