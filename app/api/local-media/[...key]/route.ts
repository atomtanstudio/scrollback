import { NextRequest } from "next/server";
import { isLocalStorageConfigured, readLocalMedia } from "@/lib/storage/local";
import { requireAuth } from "@/lib/auth/session";
import { canAccessMediaStorageKey } from "@/lib/storage/media-access";

export const dynamic = "force-dynamic";

const ALLOWED_PREFIXES = ["media/"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const session = await requireAuth();
  if (session instanceof Response) return session;

  if (!isLocalStorageConfigured()) {
    return new Response("Local media storage not configured", { status: 503 });
  }

  const { key: keyParts } = await params;
  const key = keyParts.join("/");

  if (!ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    return new Response("Forbidden", { status: 403 });
  }

  const canAccess = await canAccessMediaStorageKey(key, session.user.id, session.user.role);
  if (!canAccess) {
    return new Response("Not found", { status: 404 });
  }

  const file = await readLocalMedia(key);
  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  const { buffer, contentType } = file;

  // Basic range support for video streaming
  const rangeHeader = request.headers.get("range");
  if (rangeHeader && contentType.startsWith("video/")) {
    const totalSize = buffer.byteLength;
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
      const chunk = buffer.slice(start, end + 1);
      return new Response(chunk, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunk.byteLength),
          "Cache-Control": "private, max-age=31536000, immutable",
        },
      });
    }
  }

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.byteLength),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
