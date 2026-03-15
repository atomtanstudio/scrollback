"use client";

import { CardWrapper } from "./card-wrapper";
import { VideoPoster } from "./video-poster";
import { getDisplayBodyText, getDisplayTitle } from "@/lib/content-display";
import { formatTimeAgo } from "@/lib/format";
import { getMediaDisplayUrl } from "@/lib/media-url";
import type { ContentItemWithMedia } from "@/lib/db/types";

interface ArticleCardProps {
  item: ContentItemWithMedia;
  href?: string;
}

export function ArticleCard({ item, href }: ArticleCardProps) {
  const thumbnail = item.media_items?.[0] || null;
  const displayTitle = getDisplayTitle(item);
  const displayBodyText = getDisplayBodyText(item);
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
      <div className="relative flex h-[140px] w-full items-center justify-center overflow-hidden rounded-t-[23px] bg-[#171d26]">
        {thumbnail?.stored_path || thumbnail?.original_url ? (
          <>
            {thumbnail.media_type === "video" ? (
              <VideoPoster
                src={getMediaDisplayUrl(thumbnail.stored_path, thumbnail.original_url)}
                alt={thumbnail.alt_text || displayTitle}
                className="h-full w-full object-cover object-top"
                fallbackClassName="h-full w-full bg-[#171d26]"
              />
            ) : (
              <img
                src={getMediaDisplayUrl(
                  thumbnail.stored_path,
                  thumbnail.original_url
                )}
                alt={thumbnail.alt_text || displayTitle}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover object-top"
              />
            )}
            {thumbnail.media_type === "video" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
              </div>
            )}
          </>
        ) : (
          <span className="text-xs text-[#7d7569]">No thumbnail</span>
        )}
      </div>
      <div className="p-4 pt-4">
        <div className="mb-2 flex flex-wrap gap-2">
          {item.source_platform === "rss" && (
            <div className="inline-flex rounded-full border border-[rgba(184,148,98,0.24)] bg-[rgba(184,148,98,0.16)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f0cf9f]">
              RSS
            </div>
          )}
          {sourceDomain && (
            <div className="inline-flex rounded-full border border-[rgba(184,148,98,0.24)] bg-[rgba(184,148,98,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e0c29c]">
              {sourceDomain}
            </div>
          )}
        </div>
        <h3 className="mb-2 font-heading text-[1.05rem] font-semibold leading-tight tracking-[-0.03em] text-[#f2ede5] line-clamp-2">
          {displayTitle}
        </h3>
        <p className="mb-3 text-sm leading-7 text-[#b4ab9d] line-clamp-2">
          {displayBodyText}
        </p>
        <div className="flex items-center justify-between gap-3 text-xs text-[#7d7569]">
          <span className="truncate">
            {item.author_display_name || item.author_handle}
          </span>
          <span className="shrink-0">Captured {formatTimeAgo(item.created_at)}</span>
        </div>
      </div>
    </CardWrapper>
  );
}
