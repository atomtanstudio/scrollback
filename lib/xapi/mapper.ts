import type { CapturePayload } from "@/lib/db/types";
import { classifySourceType } from "@/lib/content-classifier";

type XUser = {
  id: string;
  username?: string;
  name?: string;
  profile_image_url?: string | null;
};

type XMediaVariant = {
  content_type?: string;
  url?: string;
  bit_rate?: number;
};

type XMedia = {
  media_key?: string;
  type?: string;
  url?: string | null;
  preview_image_url?: string | null;
  variants?: XMediaVariant[];
};

type XTweetReference = {
  type?: string;
  id?: string;
};

type XTweet = {
  id: string;
  author_id?: string;
  text?: string;
  created_at?: string;
  conversation_id?: string;
  attachments?: { media_keys?: string[] };
  referenced_tweets?: XTweetReference[];
  note_tweet?: { text?: string };
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    impression_count?: number;
  };
};

/**
 * Detect self-threads in a batch of payloads: if 2+ tweets from the same
 * author share a conversation_id, mark all of them as "thread".
 */
export function detectSelfThreadsInBatch(payloads: CapturePayload[]): void {
  // Group by conversation_id
  const convGroups = new Map<string, CapturePayload[]>();
  for (const p of payloads) {
    if (!p.conversation_id) continue;
    const group = convGroups.get(p.conversation_id) || [];
    group.push(p);
    convGroups.set(p.conversation_id, group);
  }

  for (const [, siblings] of Array.from(convGroups.entries())) {
    if (siblings.length < 2) continue;
    // Count per author
    const authorCounts = new Map<string, number>();
    for (const s of siblings) {
      const author = (s.author_handle || "").toLowerCase();
      if (author) authorCounts.set(author, (authorCounts.get(author) || 0) + 1);
    }
    // If any author has 2+ tweets → self-thread
    for (const [author, count] of Array.from(authorCounts.entries())) {
      if (count >= 2) {
        for (const s of siblings) {
          if ((s.author_handle || "").toLowerCase() === author && s.source_type !== "article") {
            s.source_type = "thread";
          }
        }
      }
    }
  }
}

function resolveMediaUrlsFromTweet(tweet: XTweet, mediaByKey: Map<string, XMedia>, target: Set<string>): void {
  const keys = tweet.attachments?.media_keys || [];
  for (const key of keys) {
    const m = mediaByKey.get(key);
    if (!m) continue;

    if (m.type === "video" || m.type === "animated_gif") {
      const mp4s = (m.variants || [])
        .filter((v) => v.content_type === "video/mp4" && v.url)
        .sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0));
      if (mp4s[0]?.url) target.add(mp4s[0].url);
      else if (m.preview_image_url) target.add(m.preview_image_url);
      continue;
    }

    if (m.url) target.add(m.url);
    else if (m.preview_image_url) target.add(m.preview_image_url);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTweetToPayload(
  tweet: XTweet,
  users: XUser[],
  media: XMedia[],
  referencedTweets: XTweet[] = []
): CapturePayload {
  const author = users.find((u) => u.id === tweet.author_id);
  const mediaByKey = new Map(
    media
      .filter((item): item is XMedia & { media_key: string } => !!item?.media_key)
      .map((item) => [item.media_key, item])
  );
  const referencedById = new Map(
    referencedTweets
      .filter((item): item is XTweet & { id: string } => !!item?.id)
      .map((item) => [item.id, item])
  );

  const mediaUrls = new Set<string>();
  resolveMediaUrlsFromTweet(tweet, mediaByKey, mediaUrls);

  const quotedRef = (tweet.referenced_tweets || []).find((ref) => ref.type === "quoted" && !!ref.id);
  const quotedTweet = quotedRef?.id ? referencedById.get(quotedRef.id) : null;
  if (quotedTweet) {
    resolveMediaUrlsFromTweet(quotedTweet, mediaByKey, mediaUrls);
  }

  const bodyText: string = tweet.note_tweet?.text || tweet.text || "";
  const mediaUrlList = Array.from(mediaUrls);

  return {
    external_id: tweet.id,
    source_url: author
      ? `https://x.com/${author.username}/status/${tweet.id}`
      : `https://x.com/i/web/status/${tweet.id}`,
    source_type: classifySourceType(
      bodyText,
      mediaUrlList,
      mediaUrlList.some((u) => u.includes(".mp4")),
      false, // X API sync doesn't handle articles
      false
    ),
    author_handle: author?.username || null,
    author_display_name: author?.name || null,
    author_avatar_url: author?.profile_image_url?.replace("_normal", "_400x400") || null,
    title: null,
    body_text: bodyText,
    posted_at: tweet.created_at || null,
    media_urls: mediaUrlList,
    conversation_id: tweet.conversation_id || null,
    likes: tweet.public_metrics?.like_count ?? null,
    retweets: tweet.public_metrics?.retweet_count ?? null,
    replies: tweet.public_metrics?.reply_count ?? null,
    views: tweet.public_metrics?.impression_count ?? null,
  };
}
