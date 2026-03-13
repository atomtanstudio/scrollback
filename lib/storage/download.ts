import { uploadMedia } from "./r2";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DOWNLOAD_TIMEOUT = 30_000; // 30 seconds

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

function extractExtension(url: string, contentType: string): string {
  // Try URL first
  const urlPath = url.split("?")[0];
  const urlExt = urlPath.split(".").pop()?.toLowerCase();
  if (urlExt && urlExt.length <= 5 && /^[a-z0-9]+$/.test(urlExt)) {
    return urlExt;
  }

  // Fall back to content-type
  return CONTENT_TYPE_TO_EXT[contentType] || "bin";
}

export async function downloadAndStoreMedia(
  mediaId: string,
  contentItemId: string,
  originalUrl: string
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

    const response = await fetch(originalUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "FeedSilo/1.0" },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`Media download failed (${response.status}): ${originalUrl}`);
      return null;
    }

    // Check file size
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_FILE_SIZE) {
      console.warn(`Media too large (${contentLength} bytes), skipping: ${originalUrl}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const ext = extractExtension(originalUrl, contentType);
    const key = `media/${contentItemId}/${mediaId}.${ext}`;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await uploadMedia(key, buffer, contentType);
  } catch (error) {
    console.warn(`Media download error for ${originalUrl}:`, error instanceof Error ? error.message : error);
    return null;
  }
}
