import { getClient } from "@/lib/db/client";
import { getSearchProvider } from "@/lib/db/search-provider";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const prisma = await getClient();
        const provider = await getSearchProvider();

        const items = await prisma.contentItem.findMany({
          select: {
            id: true,
            title: true,
            body_text: true,
            ai_summary: true,
            author_handle: true,
            author_display_name: true,
          },
        });

        const total = items.length;
        if (total === 0) {
          send({ progress: 1, processed: 0, total: 0, done: true });
          controller.close();
          return;
        }

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const authorParts = [item.author_handle, item.author_display_name]
            .filter(Boolean)
            .join(" ");

          await provider.updateSearchVector(item.id, {
            title: item.title || "",
            body: item.body_text || "",
            summary: item.ai_summary || undefined,
            author: authorParts || undefined,
          });

          send({
            progress: (i + 1) / total,
            processed: i + 1,
            total,
            current: `Indexing "${(item.title || "").slice(0, 40)}..."`,
          });
        }

        send({ progress: 1, processed: total, total, done: true });
      } catch (err) {
        send({
          error: err instanceof Error ? err.message : "Reindex failed",
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
