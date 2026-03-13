import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import { getClient } from "@/lib/db/client";
import { getSearchProvider } from "@/lib/db/search-provider";
import { generateEmbedding } from "@/lib/embeddings/gemini";
import type { CapturePayload, CaptureResult } from "@/lib/db/types";

function sanitizeText(s: string | null | undefined): string | null {
  if (!s) return null;
  return Buffer.from(s, "utf-8").toString("utf-8").replace(/\0/g, "");
}

function detectMediaType(url: string): "image" | "video" | "gif" {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "mp4") return "video";
  if (ext === "gif") return "gif";
  return "image";
}

export async function ingestItem(payload: CapturePayload): Promise<CaptureResult> {
  const prisma = await getClient();

  // Check for duplicate
  const existing = await prisma.contentItem.findFirst({
    where: { external_id: payload.external_id },
  });

  if (existing) {
    return { success: true, already_exists: true };
  }

  const bodyText = sanitizeText(payload.body_text) || "";
  const title = sanitizeText(payload.title);
  const authorHandle = sanitizeText(payload.author_handle);
  const authorDisplayName = sanitizeText(payload.author_display_name);
  const cleanHandle = authorHandle?.startsWith("@") ? authorHandle.slice(1) : authorHandle;

  const contentHash = createHash("sha256")
    .update(bodyText + payload.source_url)
    .digest("hex");

  const itemId = uuidv4();
  const itemTitle = title || (bodyText.slice(0, 100) || "Untitled");

  // Create content item via Prisma
  await prisma.contentItem.create({
    data: {
      id: itemId,
      source_type: (payload.source_type as any) || "tweet",
      external_id: payload.external_id,
      author_handle: cleanHandle,
      author_display_name: authorDisplayName,
      author_avatar_url: payload.author_avatar_url,
      title: itemTitle,
      body_text: bodyText,
      original_url: payload.source_url,
      posted_at: payload.posted_at ? new Date(payload.posted_at) : null,
      likes: payload.likes,
      retweets: payload.retweets,
      replies: payload.replies,
      views: payload.views,
      raw_markdown: bodyText,
      source_file_path: `extension://${payload.external_id}`,
      content_hash: contentHash,
      processing_status: "parsed",
    },
  });

  // Create media records
  if (payload.media_urls && payload.media_urls.length > 0) {
    // TODO: SQLite uses prisma.mediaItem — abstract when adding SQLite ingest support
    await prisma.media.createMany({
      data: payload.media_urls.map((url, position) => ({
        id: uuidv4(),
        content_item_id: itemId,
        media_type: detectMediaType(url) as any,
        original_url: url,
        position_in_content: position,
      })),
    });
  }

  // Fire-and-forget background indexing
  indexItemInBackground(itemId, itemTitle, bodyText, cleanHandle, authorDisplayName).catch(err =>
    console.error(`Background indexing failed for ${itemId}:`, err)
  );

  return { success: true, already_exists: false, item_id: itemId };
}

async function indexItemInBackground(
  itemId: string,
  title: string,
  body: string,
  authorHandle: string | null,
  authorDisplayName: string | null
): Promise<void> {
  const prisma = await getClient();
  try {
    const provider = await getSearchProvider();

    // Update tsvector
    const authorParts = [authorHandle, authorDisplayName].filter(Boolean).join(" ");
    await provider.updateSearchVector(itemId, {
      title,
      body,
      author: authorParts || undefined,
    });

    // Generate and write embedding
    if (process.env.GEMINI_API_KEY) {
      const embeddingText = [title, body, authorHandle, authorDisplayName]
        .filter(Boolean)
        .join(" ");
      const embedding = await generateEmbedding(embeddingText);
      await provider.writeEmbedding(itemId, embedding);

      await prisma.contentItem.update({
        where: { id: itemId },
        data: { processing_status: "indexed" },
      });
    }
  } catch (error) {
    console.error(`Background indexing failed for ${itemId}:`, error);
    try {
      await prisma.contentItem.update({
        where: { id: itemId },
        data: {
          processing_status: "error",
          processing_error: error instanceof Error ? error.message : "Unknown indexing error",
        },
      });
    } catch {} // Don't throw on error update failure
  }
}
