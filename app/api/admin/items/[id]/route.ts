import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getClient } from "@/lib/db/client";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const db = await getClient();
  const updates = await request.json();

  // Whitelist editable fields
  const allowed = [
    "source_type", "author_handle", "author_display_name",
    "title", "body_text", "original_url", "posted_at",
  ];

  const VALID_SOURCE_TYPES = ["tweet", "article", "thread", "image_prompt", "video_prompt", "unknown"];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  for (const key of allowed) {
    if (key in updates) {
      data[key] = updates[key];
    }
  }

  // Validate source_type enum value
  if (data.source_type !== undefined) {
    if (typeof data.source_type !== "string" || !VALID_SOURCE_TYPES.includes(data.source_type)) {
      return NextResponse.json(
        { error: `Invalid source_type. Must be one of: ${VALID_SOURCE_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
  }

  // Validate string fields
  for (const field of ["author_handle", "author_display_name", "title", "body_text", "original_url"]) {
    if (data[field] !== undefined && data[field] !== null && typeof data[field] !== "string") {
      return NextResponse.json(
        { error: `Field "${field}" must be a string` },
        { status: 400 }
      );
    }
  }

  if (data.posted_at) {
    const parsed = new Date(data.posted_at);
    if (isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "Field \"posted_at\" must be a valid date" },
        { status: 400 }
      );
    }
    data.posted_at = parsed;
  }

  // Verify ownership
  const existing = await db.contentItem.findFirst({ where: { id, user_id: session.user.id } });
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const item = await db.contentItem.update({
    where: { id },
    data,
  });

  // Regenerate search vector in background
  if (data.body_text || data.title) {
    db.$queryRawUnsafe(
      `UPDATE content_items SET search_vector = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body_text,'') || ' ' || coalesce(author_handle,'')) WHERE id = $1::uuid`,
      id
    ).catch((err: Error) => console.error("Search vector update failed:", err));
  }

  return NextResponse.json({ success: true, item });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const db = await getClient();
  const existing = await db.contentItem.findFirst({ where: { id, user_id: session.user.id } });
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  await db.contentItem.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
