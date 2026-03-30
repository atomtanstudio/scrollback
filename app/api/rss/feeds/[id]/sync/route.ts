import { NextRequest, NextResponse } from "next/server";
import { syncRssFeed } from "@/lib/rss/service";
import { sanitizeErrorMessage } from "@/lib/security/redact";
import { requireAuth } from "@/lib/auth/session";
import { getClient } from "@/lib/db/client";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;

    // Verify access: admin can sync any feed, others only their own
    const prisma = await getClient();
    const feed = await prisma.rssFeed.findUnique({
      where: { id },
      select: { user_id: true },
    });

    if (!feed) {
      return NextResponse.json({ error: "Feed not found" }, { status: 404 });
    }

    if (session.user.role !== "admin" && feed.user_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await syncRssFeed(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Failed to sync feed") },
      { status: 500 }
    );
  }
}
