import type { CapturePayload } from "@/lib/db/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectSourceTypeFromApi(tweet: any, mediaUrls: string[]): string {
  // Thread detection
  if (tweet.conversation_id && tweet.conversation_id !== tweet.id) return "thread";

  const bodyText: string = tweet.note_tweet?.text || tweet.text || "";

  // Art prompt detection (only if tweet has media)
  if (mediaUrls.length > 0 && bodyText) {
    const text = bodyText.toLowerCase();

    // Midjourney
    if (/--ar\s+\d+:\d+/.test(text) || /\/imagine\b/.test(text) || /\bmidjourney\b/.test(text)) {
      return "image_prompt";
    }
    // DALL-E
    if (/\bdall[-·\s]?e\b/i.test(bodyText)) return "image_prompt";
    // Stable Diffusion / SDXL / ComfyUI
    if (/\bstable\s*diffusion\b/i.test(bodyText) || /\bsdxl\b/i.test(bodyText) || /\bcomfyui\b/i.test(bodyText)) {
      return "image_prompt";
    }
    // Flux
    if (/\bflux\b/i.test(bodyText) && /\b(pro|dev|schnell|1\.1)\b/i.test(bodyText)) {
      return "image_prompt";
    }
    // Generic "generated with/using/by [tool]"
    if (/\b(generated|created|made)\s+(with|using|by|in)\s+(midjourney|dall-?e|stable.?diffusion|flux|leonardo|firefly)/i.test(bodyText)) {
      return "image_prompt";
    }
    // Video tools
    if (/\b(sora|runway|pika|kling|hailuo)\b/i.test(bodyText)) {
      const hasVideo = mediaUrls.some((u) => u.includes(".mp4"));
      return hasVideo ? "video_prompt" : "image_prompt";
    }
  }

  return "tweet";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTweetToPayload(tweet: any, users: any[], media: any[]): CapturePayload {
  const author = users.find((u: { id: string }) => u.id === tweet.author_id);

  // Resolve media URLs
  const mediaUrls: string[] = [];
  if (tweet.attachments?.media_keys) {
    for (const key of tweet.attachments.media_keys) {
      const m = media.find((item: { media_key: string }) => item.media_key === key);
      if (!m) continue;
      if (m.type === "video" || m.type === "animated_gif") {
        const mp4s = (m.variants || [])
          .filter((v: { content_type: string; url: string }) => v.content_type === "video/mp4" && v.url)
          .sort((a: { bit_rate?: number }, b: { bit_rate?: number }) => (b.bit_rate || 0) - (a.bit_rate || 0));
        if (mp4s[0]) mediaUrls.push(mp4s[0].url);
        else if (m.preview_image_url) mediaUrls.push(m.preview_image_url);
      } else {
        if (m.url) mediaUrls.push(m.url);
        else if (m.preview_image_url) mediaUrls.push(m.preview_image_url);
      }
    }
  }

  const bodyText: string = tweet.note_tweet?.text || tweet.text || "";

  return {
    external_id: tweet.id,
    source_url: author
      ? `https://x.com/${author.username}/status/${tweet.id}`
      : `https://x.com/i/web/status/${tweet.id}`,
    source_type: detectSourceTypeFromApi(tweet, mediaUrls),
    author_handle: author?.username || null,
    author_display_name: author?.name || null,
    author_avatar_url: author?.profile_image_url?.replace("_normal", "_400x400") || null,
    title: null,
    body_text: bodyText,
    posted_at: tweet.created_at || null,
    media_urls: mediaUrls,
    conversation_id: tweet.conversation_id || null,
    likes: tweet.public_metrics?.like_count ?? null,
    retweets: tweet.public_metrics?.retweet_count ?? null,
    replies: tweet.public_metrics?.reply_count ?? null,
    views: tweet.public_metrics?.impression_count ?? null,
  };
}
