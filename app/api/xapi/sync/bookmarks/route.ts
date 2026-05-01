import { NextResponse } from "next/server";
import { fetchBookmarks } from "@/lib/xapi/client";
import { detectSelfThreadsInBatch, mapTweetToPayload } from "@/lib/xapi/mapper";
import { ingestItem } from "@/lib/ingest";
import type { CapturePayload } from "@/lib/db/types";
import { requireAdmin } from "@/lib/auth/session";

export async function POST() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  const userId = session.user.id;
  let synced = 0;
  let skipped = 0;
  let errors = 0;
  let paginationToken: string | undefined;

  try {
    do {
      const data = await fetchBookmarks(paginationToken);
      const tweets = data.data || [];
      const users = data.includes?.users || [];
      const media = data.includes?.media || [];
      const referencedTweets = data.includes?.tweets || [];

      const payloads: CapturePayload[] = (tweets as Array<Parameters<typeof mapTweetToPayload>[0]>).map((tweet) =>
        mapTweetToPayload(tweet, users, media, referencedTweets)
      );
      detectSelfThreadsInBatch(payloads);

      for (const payload of payloads) {
        try {
          const result = await ingestItem(payload, userId);
          if (result.already_exists) skipped++;
          else synced++;
        } catch (err) {
          errors++;
          console.error("FeedSilo: bookmark ingest error:", err instanceof Error ? err.message : err);
        }
      }

      paginationToken = data.meta?.next_token;
    } while (paginationToken);

    return NextResponse.json({ success: true, synced, skipped, errors });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
        synced,
        skipped,
        errors,
      },
      { status: 500 }
    );
  }
}
