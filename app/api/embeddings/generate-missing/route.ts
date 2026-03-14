import { getClient } from "@/lib/db/client";
import { getSearchProvider } from "@/lib/db/search-provider";
import { generateEmbedding } from "@/lib/embeddings/gemini";

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
        if (!process.env.GEMINI_API_KEY) {
          send({ error: "GEMINI_API_KEY not configured", done: true });
          controller.close();
          return;
        }

        const prisma = await getClient();
        const provider = await getSearchProvider();

        const items = await prisma.contentItem.findMany({
          where: {
            processing_status: { not: "indexed" },
          },
          select: {
            id: true,
            title: true,
            body_text: true,
            author_handle: true,
            author_display_name: true,
          },
          take: 500,
          orderBy: { created_at: "desc" },
        });

        const total = items.length;
        if (total === 0) {
          send({ progress: 1, processed: 0, total: 0, done: true });
          controller.close();
          return;
        }

        for (let i = 0; i < items.length; i++) {
          if (cancelled) break;

          const item = items[i];
          try {
            const embeddingText = [
              item.title,
              item.body_text,
              item.author_handle,
              item.author_display_name,
            ]
              .filter(Boolean)
              .join(" ");

            const embedding = await generateEmbedding(embeddingText);
            await provider.writeEmbedding(item.id, embedding);

            await prisma.contentItem.update({
              where: { id: item.id },
              data: { processing_status: "indexed" },
            });

            send({
              progress: (i + 1) / total,
              processed: i + 1,
              total,
              current: `Processing "${(item.title || "").slice(0, 40)}..."`,
            });
          } catch (err) {
            send({
              progress: (i + 1) / total,
              processed: i + 1,
              total,
              current: `Failed: ${err instanceof Error ? err.message : "unknown error"}`,
            });
          }
        }

        if (!cancelled) {
          send({ progress: 1, processed: total, total, done: true });
        }
      } catch (err) {
        send({
          error: err instanceof Error ? err.message : "Generation failed",
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
