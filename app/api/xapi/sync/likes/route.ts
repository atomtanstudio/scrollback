import { NextResponse } from "next/server";
import { fetchLikedTweets } from "@/lib/xapi/client";
import { mapTweetToPayload } from "@/lib/xapi/mapper";
import { ingestItem } from "@/lib/ingest";

export async function POST() {
  let synced = 0;
  let skipped = 0;
  let errors = 0;
  let paginationToken: string | undefined;

  try {
    do {
      const data = await fetchLikedTweets(paginationToken);
      const tweets = data.data || [];
      const users = data.includes?.users || [];
      const media = data.includes?.media || [];

      for (const tweet of tweets) {
        try {
          const payload = mapTweetToPayload(tweet, users, media);
          const result = await ingestItem(payload);
          if (result.already_exists) skipped++;
          else synced++;
        } catch (err) {
          errors++;
          console.error("FeedSilo: like ingest error:", err instanceof Error ? err.message : err);
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
