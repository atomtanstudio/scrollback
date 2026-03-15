import { NextRequest, NextResponse } from "next/server";
import { createRssFeed, listRssFeeds, previewRssFeed, syncAllRssFeeds } from "@/lib/rss/service";
import { sanitizeErrorMessage } from "@/lib/security/redact";

export async function GET() {
  try {
    const feeds = await listRssFeeds();
    return NextResponse.json({ feeds });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Failed to load feeds") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body?.action;

    if (action === "sync-all") {
      const result = await syncAllRssFeeds();
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "preview") {
      const feedUrl = typeof body?.feedUrl === "string" ? body.feedUrl : "";
      const preview = await previewRssFeed(feedUrl);
      return NextResponse.json({ success: true, preview });
    }

    const feedUrl = typeof body?.feedUrl === "string" ? body.feedUrl : "";
    const feed = await createRssFeed(feedUrl);
    return NextResponse.json({ success: true, feed });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "RSS operation failed") },
      { status: 500 }
    );
  }
}
