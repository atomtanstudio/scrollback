import { describe, expect, it } from "vitest";
import { detectSelfThreadsInBatch, mapTweetToPayload } from "@/lib/xapi/mapper";

describe("mapTweetToPayload", () => {
  it("does not classify a lone reply as a thread", () => {
    const payload = mapTweetToPayload(
      {
        id: "reply-1",
        author_id: "user-1",
        text: "@someone thanks for the tip",
        conversation_id: "root-1",
        created_at: "2026-03-05T18:28:47.000Z",
        public_metrics: {
          like_count: 5,
          retweet_count: 1,
          reply_count: 2,
          impression_count: 100,
        },
      },
      [{ id: "user-1", username: "screenshotfirst", name: "Screenshot First", profile_image_url: null }],
      []
    );

    expect(payload.source_type).toBe("tweet");
    expect(payload.conversation_id).toBe("root-1");
  });

  it("includes quoted tweet media when the visible tweet has none", () => {
    const payload = mapTweetToPayload(
      {
        id: "reply-1",
        author_id: "user-1",
        text: "@alexcooldev that's what we're here for",
        conversation_id: "root-1",
        referenced_tweets: [{ type: "quoted", id: "quoted-1" }],
      },
      [{ id: "user-1", username: "screenshotfirst", name: "Screenshot First", profile_image_url: null }],
      [
        {
          media_key: "video-key",
          type: "video",
          preview_image_url: "https://pbs.twimg.com/amplify_video_thumb/quoted-1.jpg",
          variants: [
            { content_type: "video/mp4", bit_rate: 256000, url: "https://video.twimg.com/quoted-low.mp4" },
            { content_type: "video/mp4", bit_rate: 832000, url: "https://video.twimg.com/quoted-high.mp4" },
          ],
        },
      ],
      [
        {
          id: "quoted-1",
          attachments: { media_keys: ["video-key"] },
        },
      ]
    );

    expect(payload.media_urls).toEqual(["https://video.twimg.com/quoted-high.mp4"]);
  });
});

describe("detectSelfThreadsInBatch", () => {
  it("upgrades same-author siblings in one conversation to thread", () => {
    const payloads = [
      {
        external_id: "root-1",
        source_url: "https://x.com/screenshotfirst/status/root-1",
        source_type: "tweet",
        author_handle: "screenshotfirst",
        body_text: "first post",
        conversation_id: "root-1",
      },
      {
        external_id: "reply-1",
        source_url: "https://x.com/screenshotfirst/status/reply-1",
        source_type: "tweet",
        author_handle: "screenshotfirst",
        body_text: "second post",
        conversation_id: "root-1",
      },
      {
        external_id: "other-1",
        source_url: "https://x.com/other/status/other-1",
        source_type: "tweet",
        author_handle: "other",
        body_text: "reply from someone else",
        conversation_id: "root-1",
      },
    ];

    detectSelfThreadsInBatch(payloads);

    expect(payloads[0].source_type).toBe("thread");
    expect(payloads[1].source_type).toBe("thread");
    expect(payloads[2].source_type).toBe("tweet");
  });
});
