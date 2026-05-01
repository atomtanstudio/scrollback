import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/auth/session";
import { ingestItem } from "@/lib/ingest";

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const { source_url, body_text, source_type, author_handle, title, posted_at, media_urls } = body;

  if (!source_url && !body_text) {
    return NextResponse.json(
      { error: "At least source_url or body_text is required" },
      { status: 400 }
    );
  }

  // Admin can create items in another user's library via userId in body
  const targetUserId =
    body.userId && session.user.role === "admin" ? body.userId : session.user.id;

  const result = await ingestItem({
    external_id: `manual-${randomUUID()}`,
    source_url: source_url || "",
    source_type: source_type || "tweet",
    body_text: body_text || "",
    title: title || null,
    author_handle: author_handle || null,
    posted_at: posted_at || null,
    media_urls: media_urls || [],
  }, targetUserId);

  return NextResponse.json(result);
}
