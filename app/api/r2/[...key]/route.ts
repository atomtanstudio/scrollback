import { NextRequest } from "next/server";
import { isR2Configured, getR2Object } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

const ALLOWED_PREFIXES = ["media/"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: keyParts } = await params;
  const key = keyParts.join("/");

  // Security: only allow known prefixes
  if (!ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!isR2Configured()) {
    return new Response("R2 not configured", { status: 503 });
  }

  const object = await getR2Object(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": object.contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  if (object.contentLength) {
    headers["Content-Length"] = String(object.contentLength);
  }

  return new Response(object.body, { headers });
}
