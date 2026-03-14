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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  for (const key of allowed) {
    if (key in updates) {
      data[key] = updates[key];
    }
  }

  if (data.posted_at) {
    data.posted_at = new Date(data.posted_at);
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
  await db.contentItem.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
