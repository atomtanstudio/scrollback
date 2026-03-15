import { NextRequest, NextResponse } from "next/server";
import { syncRssFeed } from "@/lib/rss/service";
import { sanitizeErrorMessage } from "@/lib/security/redact";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await syncRssFeed(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Failed to sync feed") },
      { status: 500 }
    );
  }
}
