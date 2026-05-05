import { uploadMedia, uploadMediaStream, isR2Configured } from "./r2";
import { isLocalStorageConfigured, saveMediaLocally, saveMediaLocallyStream } from "./local";
import { safeFetch } from "@/lib/security/safe-fetch";

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

export function limitReadableStreamBytes(
  body: ReadableStream<Uint8Array>,
  maxBytes: number = MAX_FILE_SIZE
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let bytesRead = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel("media file exceeded size limit").catch(() => undefined);
        controller.error(new Error(`Media exceeds maximum size of ${maxBytes} bytes`));
        return;
      }

      controller.enqueue(value);
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => undefined);
    },
  });
}

export async function downloadAndStoreMedia(
  mediaId: string,
  contentItemId: string,
  originalUrl: string
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

    const response = await safeFetch(originalUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Scrollback/1.0" },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`Media download failed (${response.status}): ${originalUrl}`);
      return null;
    }

    // Check file size
    const contentLengthHeader = response.headers.get("content-length");
    const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null;
    const hasKnownContentLength = typeof contentLength === "number" && Number.isFinite(contentLength);
    if (hasKnownContentLength && contentLength > MAX_FILE_SIZE) {
      console.warn(`Media too large (${contentLength} bytes), skipping: ${originalUrl}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const ext = extractExtension(originalUrl, contentType);
    const key = `media/${contentItemId}/${mediaId}.${ext}`;
    const useStreaming =
      !hasKnownContentLength ||
      contentLength > STREAM_THRESHOLD ||
      (contentLength === 0 && contentType.startsWith("video/"));

    if (isR2Configured()) {
      // Use streaming upload for large files to avoid OOM
      if (useStreaming) {
        if (!response.body) {
          console.warn(`No response body for streaming: ${originalUrl}`);
          return null;
        }
        return await uploadMediaStream(key, limitReadableStreamBytes(response.body), contentType);
      }
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
        console.warn(`Media too large (${arrayBuffer.byteLength} bytes), skipping: ${originalUrl}`);
        return null;
      }
      return await uploadMedia(key, Buffer.from(arrayBuffer), contentType);
    }

    if (isLocalStorageConfigured()) {
      if (useStreaming && response.body) {
        return await saveMediaLocallyStream(key, limitReadableStreamBytes(response.body));
      }
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
        console.warn(`Media too large (${arrayBuffer.byteLength} bytes), skipping: ${originalUrl}`);
        return null;
      }
      return await saveMediaLocally(key, Buffer.from(arrayBuffer));
    }

    return null;
  } catch (error) {
    console.warn(`Media download error for ${originalUrl}:`, error instanceof Error ? error.message : error);
    return null;
  }
}
