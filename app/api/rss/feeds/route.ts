import { NextRequest, NextResponse } from "next/server";
import { createRssFeed, listRssFeeds, previewRssFeed, syncAllRssFeeds } from "@/lib/rss/service";
import { sanitizeErrorMessage } from "@/lib/security/redact";
import { requireAuth } from "@/lib/auth/session";

/** Resolve which userId to operate on. Admins can pass ?userId= to manage other users' feeds. */
function resolveUserId(session: { user: { id: string; role: string } }, requestedUserId?: string | null): string {
  if (requestedUserId && session.user.role === "admin") {
    return requestedUserId;
  }
  return session.user.id;
}

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const userId = resolveUserId(session, request.nextUrl.searchParams.get("userId"));

  try {
    const feeds = await listRssFeeds(userId);
    return NextResponse.json({ feeds });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Failed to load feeds") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const action = body?.action;
    const userId = resolveUserId(session, body?.userId);

    if (action === "sync-all") {
      if (session.user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const result = await syncAllRssFeeds();
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "preview") {
      const feedUrl = typeof body?.feedUrl === "string" ? body.feedUrl : "";
      const preview = await previewRssFeed(feedUrl);
      return NextResponse.json({ success: true, preview });
    }

    const feedUrl = typeof body?.feedUrl === "string" ? body.feedUrl : "";
    const feed = await createRssFeed(feedUrl, userId);
    return NextResponse.json({ success: true, feed });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "RSS operation failed") },
      { status: 500 }
    );
  }
}
