import { uploadMedia, uploadMediaStream, isR2Configured } from "./r2";
import { isLocalStorageConfigured, saveMediaLocally, saveMediaLocallyStream } from "./local";

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB (videos can be large)
const DOWNLOAD_TIMEOUT = 300_000; // 5 minutes (large video downloads)
// Files above this threshold use streaming upload to avoid OOM
const STREAM_THRESHOLD = 50 * 1024 * 1024; // 50MB

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
    // Validate URL before fetching
    let parsed: URL;
    try {
      parsed = new URL(originalUrl);
    } catch {
      console.warn(`Invalid URL, skipping: ${originalUrl}`);
      return null;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      console.warn(`Disallowed protocol "${parsed.protocol}", skipping: ${originalUrl}`);
      return null;
    }

    const forbiddenHosts = ["localhost", "127.0.0.1", "::1"];
    if (forbiddenHosts.includes(parsed.hostname)) {
      console.warn(`SSRF blocked for host "${parsed.hostname}", skipping: ${originalUrl}`);
      return null;
    }

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
    const useStreaming = contentLength > STREAM_THRESHOLD || (contentLength === 0 && contentType.startsWith("video/"));

    if (isR2Configured()) {
      // Use streaming upload for large files to avoid OOM
      if (useStreaming) {
        if (!response.body) {
          console.warn(`No response body for streaming: ${originalUrl}`);
          return null;
        }
        return await uploadMediaStream(key, response.body, contentType);
      }
      const arrayBuffer = await response.arrayBuffer();
      return await uploadMedia(key, Buffer.from(arrayBuffer), contentType);
    }

    if (isLocalStorageConfigured()) {
      if (useStreaming && response.body) {
        return await saveMediaLocallyStream(key, response.body);
      }
      const arrayBuffer = await response.arrayBuffer();
      return await saveMediaLocally(key, Buffer.from(arrayBuffer));
    }

    return null;
  } catch (error) {
    console.warn(`Media download error for ${originalUrl}:`, error instanceof Error ? error.message : error);
    return null;
  }
}
