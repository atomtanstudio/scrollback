import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import { getClient } from "@/lib/db/client";
import { getSearchProvider } from "@/lib/db/search-provider";
import { generateEmbedding, classifyContent, describeImage } from "@/lib/embeddings/gemini";
import { getMediaDisplayUrl } from "@/lib/media-url";
import type { CapturePayload, CaptureResult } from "@/lib/db/types";
import { isR2Configured } from "@/lib/storage/r2";
import { downloadAndStoreMedia } from "@/lib/storage/download";
import { isLikelyVisualPromptText } from "@/lib/visual-prompt";

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

  const bodyHtml = sanitizeText(payload.body_html);

  const contentHash = createHash("sha256")
    .update(bodyText + payload.source_url)
    .digest("hex");

  const itemId = uuidv4();
  const itemTitle = title || (bodyText.slice(0, 100) || "Untitled");

  // Create content item via Prisma
  await prisma.contentItem.create({
    data: {
      id: itemId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      source_type: (payload.source_type as any) || "tweet",
      external_id: payload.external_id,
      author_handle: cleanHandle,
      author_display_name: authorDisplayName,
      author_avatar_url: payload.author_avatar_url,
      title: itemTitle,
      body_text: bodyText,
      body_html: bodyHtml,
      conversation_id: payload.conversation_id || null,
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
  const mediaRecords: Array<{ id: string; originalUrl: string; mediaType: string }> = [];
  if (payload.media_urls && payload.media_urls.length > 0) {
    for (let i = 0; i < payload.media_urls.length; i++) {
      const url = payload.media_urls[i];
      const mediaId = uuidv4();
      const mediaType = detectMediaType(url);
      await prisma.media.create({
        data: {
          id: mediaId,
          content_item_id: itemId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          media_type: mediaType as any,
          original_url: url,
          position_in_content: i,
        },
      });
      mediaRecords.push({ id: mediaId, originalUrl: url, mediaType });
    }
  }

  // Server-side self-thread detection: if other items share the same
  // conversation_id and author, this is a self-thread — upgrade all to "thread"
  const conversationId = payload.conversation_id || null;
  if (conversationId && payload.source_type !== "article") {
    detectAndUpgradeThreads(prisma, itemId, conversationId, cleanHandle).catch(
      (err) => console.error(`Thread detection failed for ${itemId}:`, err)
    );
  }

  // Instant tags: hashtags + source type (no API call needed)
  const instantTags = extractHashtags(bodyText, payload.source_type || "tweet");
  if (instantTags.length > 0) {
    assignTagsInBackground(itemId, instantTags).catch((err) =>
      console.error(`Tag assignment failed for ${itemId}:`, err)
    );
  }

  // Fire-and-forget background indexing + AI classification
  indexAndClassifyInBackground(
    itemId, itemTitle, bodyText, payload.source_type || "tweet", cleanHandle, authorDisplayName
  ).catch(err =>
    console.error(`Background indexing failed for ${itemId}:`, err)
  );

  // Fire-and-forget R2 media download + image description
  if (mediaRecords.length > 0) {
    downloadMediaInBackground(itemId, mediaRecords).catch((err) =>
      console.error(`Background media download failed for ${itemId}:`, err)
    );
  }

  return { success: true, already_exists: false, item_id: itemId };
}

/**
 * Server-side self-thread detection: check if other items in the DB share
 * the same conversation_id and author. If 2+ items match, upgrade all to "thread".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function detectAndUpgradeThreads(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
  itemId: string,
  conversationId: string,
  authorHandle: string | null
): Promise<void> {
  if (!authorHandle) return;

  // Find siblings: items with same conversation_id and same author
  const siblings = await prisma.contentItem.findMany({
    where: {
      conversation_id: conversationId,
      author_handle: authorHandle,
      source_type: { not: "article" },
    },
    select: { id: true, source_type: true },
  });

  // If 2+ items (including the one just created), it's a self-thread
  if (siblings.length >= 2) {
    const idsToUpgrade = siblings
      .filter((s: { id: string; source_type: string }) => s.source_type !== "thread")
      .map((s: { id: string }) => s.id);

    if (idsToUpgrade.length > 0) {
      await prisma.contentItem.updateMany({
        where: { id: { in: idsToUpgrade } },
        data: { source_type: "thread" },
      });
    }
  }
}

/**
 * Extract instant tags from body text (no API call):
 * - Hashtags (#AI, #webdev, etc.)
 * - Source type as a tag
 */
function extractHashtags(bodyText: string, sourceType: string): string[] {
  const tags = new Set<string>();

  const typeLabels: Record<string, string> = {
    tweet: "tweet",
    thread: "thread",
    article: "article",
    image_prompt: "image-prompt",
    video_prompt: "video-prompt",
  };
  if (typeLabels[sourceType]) {
    tags.add(typeLabels[sourceType]);
  }

  const hashtagMatches = bodyText.match(/#(\w{2,30})/g);
  if (hashtagMatches) {
    for (const ht of hashtagMatches) {
      const clean = ht.slice(1).toLowerCase();
      if (clean.length >= 2 && !/^\d+$/.test(clean)) {
        tags.add(clean);
      }
    }
  }

  return Array.from(tags);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function assignTagsInBackground(itemId: string, tagNames: string[]): Promise<void> {
  const prisma = await getClient();

  for (const name of tagNames) {
    try {
      const slug = slugify(name);
      const tag = await prisma.tag.upsert({
        where: { slug },
        create: { name, slug },
        update: {},
      });
      await prisma.contentTag.create({
        data: {
          content_item_id: itemId,
          tag_id: tag.id,
        },
      });
    } catch (error) {
      // Skip duplicate or constraint errors silently
      if (error instanceof Error && !error.message.includes("Unique constraint")) {
        console.warn(`Failed to assign tag "${name}" to ${itemId}:`, error);
      }
    }
  }
}

async function assignCategoriesInBackground(itemId: string, categorySlugs: string[]): Promise<void> {
  const prisma = await getClient();

  for (const slug of categorySlugs) {
    try {
      const category = await prisma.category.findUnique({ where: { slug } });
      if (category) {
        await prisma.contentCategory.create({
          data: {
            content_item_id: itemId,
            category_id: category.id,
          },
        });
      }
    } catch (error) {
      if (error instanceof Error && !error.message.includes("Unique constraint")) {
        console.warn(`Failed to assign category "${slug}" to ${itemId}:`, error);
      }
    }
  }
}

/**
 * Background processing: embeddings + unified Gemini classification.
 * Single Gemini call produces: ai_summary, tags, categories, prompt detection.
 */
async function indexAndClassifyInBackground(
  itemId: string,
  title: string,
  body: string,
  sourceType: string,
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

    if (process.env.GEMINI_API_KEY) {
      // Generate embedding
      const embeddingText = [title, body, authorHandle, authorDisplayName]
        .filter(Boolean)
        .join(" ");
      const embedding = await generateEmbedding(embeddingText);
      await provider.writeEmbedding(itemId, embedding);

      // Unified Gemini classification: summary + tags + categories + prompt detection
      try {
        const allCategories = await prisma.category.findMany({ select: { slug: true } });
        const categorySlugs = allCategories.map((c: { slug: string }) => c.slug);

        const classification = await classifyContent(
          title, body, sourceType, categorySlugs, authorHandle
        );

        // Update content item with AI results
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = {
          ai_summary: classification.ai_summary || null,
          processing_status: "indexed",
        };

        const canPromoteToArt =
          classification.has_prompt &&
          !!classification.prompt_text &&
          isLikelyVisualPromptText(classification.prompt_text) &&
          classification.confidence >= 0.7;

        if (classification.has_prompt) {
          updateData.has_prompt = true;
          updateData.prompt_text = classification.prompt_text;
          if (classification.prompt_type) {
            updateData.prompt_type = classification.prompt_type;
          }
          // Reclassify source_type if Gemini detected an image/video prompt with high confidence
          if (canPromoteToArt) {
            if (classification.prompt_type === "image" && sourceType === "tweet") {
              updateData.source_type = "image_prompt";
            } else if (classification.prompt_type === "video" && sourceType === "tweet") {
              updateData.source_type = "video_prompt";
            }
          }
        }

        await prisma.contentItem.update({
          where: { id: itemId },
          data: updateData,
        });

        // Assign AI-generated tags
        if (classification.tags.length > 0) {
          await assignTagsInBackground(itemId, classification.tags);
        }

        // Assign categories
        if (classification.category_slugs.length > 0) {
          await assignCategoriesInBackground(itemId, classification.category_slugs);
        }
      } catch (classifyError) {
        console.warn(`AI classification failed for ${itemId}:`, classifyError);
        // Still mark as indexed since embedding succeeded
        await prisma.contentItem.update({
          where: { id: itemId },
          data: { processing_status: "indexed" },
        });
      }
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

/**
 * Download media to R2, then describe images via Gemini Vision.
 */
async function downloadMediaInBackground(
  contentItemId: string,
  mediaRecords: Array<{ id: string; originalUrl: string; mediaType: string }>
): Promise<void> {
  const prisma = await getClient();
  const hasR2 = isR2Configured();

  for (const { id, originalUrl, mediaType } of mediaRecords) {
    try {
      // Download to R2
      if (hasR2) {
        const storedPath = await downloadAndStoreMedia(id, contentItemId, originalUrl);
        if (storedPath) {
          await prisma.media.update({
            where: { id },
            data: { stored_path: storedPath },
          });

          // Describe images via Gemini Vision (after R2 download)
          if (process.env.GEMINI_API_KEY && (mediaType === "image" || mediaType === "gif")) {
            try {
              const displayUrl = getMediaDisplayUrl(storedPath, originalUrl);
              // Use absolute URL for server-side fetch
              const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
              const absoluteUrl = displayUrl.startsWith("/") ? `${baseUrl}${displayUrl}` : displayUrl;
              const description = await describeImage(absoluteUrl);
              if (description.alt_text || description.ai_description) {
                await prisma.media.update({
                  where: { id },
                  data: {
                    alt_text: description.alt_text || undefined,
                    ai_description: description.ai_description || undefined,
                  },
                });
              }
            } catch (describeError) {
              console.warn(`Image description failed for media ${id}:`, describeError);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to download media ${id}:`, error instanceof Error ? error.message : error);
    }
  }
}
