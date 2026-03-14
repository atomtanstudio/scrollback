"use client";

import { CardWrapper } from "./card-wrapper";
import { VideoPoster } from "./video-poster";
import { formatTimeAgo } from "@/lib/format";
import { getMediaDisplayUrl } from "@/lib/media-url";
import type { ContentItemWithMedia } from "@/lib/db/types";

interface ArticleCardProps {
  item: ContentItemWithMedia;
  href?: string;
}

export function ArticleCard({ item, href }: ArticleCardProps) {
  const thumbnail = item.media_items?.[0] || null;
  let sourceDomain: string | null = null;
  try {
    sourceDomain = item.original_url
      ? new URL(item.original_url).hostname.replace("www.", "")
      : null;
  } catch {
    sourceDomain = null;
  }

  return (
    <CardWrapper type="article" noPadding href={href}>
      <div className="w-full h-[140px] rounded-t-[13px] overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e] relative">
        {thumbnail?.stored_path || thumbnail?.original_url ? (
          <>
            {thumbnail.media_type === "video" ? (
              <VideoPoster
                src={getMediaDisplayUrl(thumbnail.stored_path, thumbnail.original_url)}
                alt={thumbnail.alt_text || item.title}
                className="w-full h-full object-cover object-top"
                fallbackClassName="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#16213e]"
              />
            ) : (
              <img src={getMediaDisplayUrl(thumbnail.stored_path, thumbnail.original_url)} alt={thumbnail.alt_text || item.title} loading="lazy" decoding="async" className="w-full h-full object-cover object-top" />
            )}
            {thumbnail.media_type === "video" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </div>
              </div>
            )}
          </>
        ) : (
          <span className="text-xs text-[#555566]">No thumbnail</span>
        )}
      </div>
      <div className="p-4 pt-3">
        {sourceDomain && (
          <div className="text-[11px] text-[var(--accent-article)] uppercase tracking-wider mb-1.5">{sourceDomain}</div>
        )}
        <h3 className="font-heading font-semibold text-[15px] leading-tight text-[#f0f0f5] mb-1.5 line-clamp-2">{item.title}</h3>
        <p className="text-sm leading-relaxed text-[#8888aa] line-clamp-2 mb-3">{item.body_text}</p>
        <div className="flex items-center justify-between text-xs text-[#555566]">
          <span>{item.author_display_name || item.author_handle}</span>
          <span>Captured {formatTimeAgo(item.created_at)}</span>
        </div>
      </div>
    </CardWrapper>
  );
}
