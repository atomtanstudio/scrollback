import { NextRequest, NextResponse } from "next/server";
import { deleteRssFeed, updateRssFeed } from "@/lib/rss/service";
import { sanitizeErrorMessage } from "@/lib/security/redact";
import { requireAuth } from "@/lib/auth/session";
import { getClient } from "@/lib/db/client";

/** Admin can operate on any feed; non-admin can only operate on their own. */
async function resolveOwnerForFeed(
  session: { user: { id: string; role: string } },
  feedId: string
): Promise<string> {
  if (session.user.role === "admin") {
    // Look up the feed's actual owner so the ownership check passes
    const prisma = await getClient();
    const feed = await prisma.rssFeed.findUnique({
      where: { id: feedId },
      select: { user_id: true },
    });
    if (feed) return feed.user_id;
  }
  return session.user.id;
}

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
    const userId = await resolveOwnerForFeed(session, id);
    const feed = await updateRssFeed(id, userId, { active });
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
    const userId = await resolveOwnerForFeed(session, id);
    await deleteRssFeed(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Failed to delete feed") },
      { status: 500 }
    );
  }
}
