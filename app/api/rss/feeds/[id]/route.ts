import { NextRequest, NextResponse } from "next/server";
import { deleteRssFeed, updateRssFeed } from "@/lib/rss/service";
import { sanitizeErrorMessage } from "@/lib/security/redact";
import { requireAuth } from "@/lib/auth/session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = await request.json();
    const active = typeof body?.active === "boolean" ? body.active : undefined;
    const feed = await updateRssFeed(id, session.user.id, { active });
    return NextResponse.json({ success: true, feed });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Failed to update feed") },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    await deleteRssFeed(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Failed to delete feed") },
      { status: 500 }
    );
  }
}
