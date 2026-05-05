import { NextRequest, NextResponse } from "next/server";
import { validateCaptureSecret } from "@/lib/auth/capture-secret";
import { fetchTweetsByIds } from "@/lib/xapi/client";
import { mapTweetToPayload, detectSelfThreadsInBatch } from "@/lib/xapi/mapper";
import { ingestItem } from "@/lib/ingest";
import type { CapturePayload } from "@/lib/db/types";

export async function POST(request: NextRequest) {
  const auth = await validateCaptureSecret(request);
  if (!auth.valid || !auth.userId) {
    const status = auth.error === "CAPTURE_SECRET not configured on server" ? 500 : 401;
    return NextResponse.json({ success: false, error: auth.error }, { status });
  }
  const userId = auth.userId;

  try {
    const { tweetIds } = await request.json();
    if (!tweetIds || !Array.isArray(tweetIds) || tweetIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "'tweetIds' array is required" },
        { status: 400 }
      );
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;
    const missingIds: string[] = [];

    // Process in batches of 100 (X API limit)
    for (let i = 0; i < tweetIds.length; i += 100) {
      const batch = tweetIds.slice(i, i + 100);

      try {
        const data = await fetchTweetsByIds(batch);
        const tweets = data.data || [];
        const users = data.includes?.users || [];
        const media = data.includes?.media || [];
        const referencedTweets = data.includes?.tweets || [];

        // Tweets not returned by API — send back for DOM fallback
        const returnedIds = new Set(tweets.map((t: { id: string }) => t.id));
        for (const id of batch) {
          if (!returnedIds.has(id)) missingIds.push(id);
        }

        // Map all tweets first, then detect self-threads across the batch
        const payloads: CapturePayload[] = [];
        for (const tweet of tweets) {
          try {
            payloads.push(mapTweetToPayload(tweet, users, media, referencedTweets));
          } catch (err) {
            errors++;
            console.error("Scrollback: tweet map error:", err instanceof Error ? err.message : err);
          }
        }
        detectSelfThreadsInBatch(payloads);

        for (const payload of payloads) {
          try {
            const result = await ingestItem(payload, userId);
            if (result.already_exists) skipped++;
            else synced++;
          } catch (err) {
            errors++;
            console.error("Scrollback: tweet ingest error:", err instanceof Error ? err.message : err);
          }
        }
      } catch (err) {
        // Batch-level failure — all IDs need DOM fallback
        missingIds.push(...batch);
        console.error("Scrollback: batch fetch error:", err instanceof Error ? err.message : err);
      }
    }

    return NextResponse.json({ success: true, synced, skipped, errors, missingIds });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
