"use client";

import { CardWrapper } from "./card-wrapper";
import { VideoPoster } from "./video-poster";
import { getDisplayBodyText } from "@/lib/content-display";
import { formatTimeAgo } from "@/lib/format";
import { getMediaDisplayUrl } from "@/lib/media-url";
import type { ContentItemWithMedia } from "@/lib/db/types";

interface TweetCardProps {
  item: ContentItemWithMedia;
  href?: string;
}

export function TweetCard({ item, href }: TweetCardProps) {
  const media = item.media_items?.[0] ?? null;
  const hasMedia = !!(media?.stored_path || media?.original_url);
  const displayBodyText = getDisplayBodyText(item);

  const initials = (item.author_display_name || item.author_handle || "??")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <CardWrapper type="tweet" noPadding={hasMedia} href={href}>
      {hasMedia &&
        (() => {
          const url = getMediaDisplayUrl(media!.stored_path, media!.original_url);
          return (
            <div className="relative flex h-[180px] w-full items-center justify-center overflow-hidden rounded-t-[23px] bg-[#171d26]">
              {media!.media_type === "video" ? (
                <VideoPoster
                  src={url}
                  alt={media!.alt_text || ""}
                  className="h-full w-full object-cover object-top"
                  fallbackClassName="h-full w-full bg-[#171d26]"
                />
              ) : (
                <img
                  src={url}
                  alt={media!.alt_text || ""}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-top"
                />
              )}
              {media!.media_type === "video" && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      <div className={hasMedia ? "px-5 py-4" : "p-5"}>
        <div className="mb-3 flex items-center gap-2.5">
          {item.author_avatar_url ? (
            <img
              src={item.author_avatar_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-8 w-8 rounded-full shrink-0"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#202733] text-xs text-[#9c9387]">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[#f2ede5]">
              {item.author_display_name || item.author_handle}
            </div>
            {item.author_handle && (
              <div className="truncate text-xs text-[#7d7569]">
                @{item.author_handle.replace(/^@/, "")}
              </div>
            )}
          </div>
        </div>
        <p className="mb-3 text-sm leading-7 text-[#b4ab9d] line-clamp-3">
          {displayBodyText}
        </p>
        <div className="flex items-center justify-between text-xs text-[#7d7569]">
          <span>Saved {formatTimeAgo(item.created_at)}</span>
          {item.original_url && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(item.original_url!, "_blank", "noopener,noreferrer");
              }}
              className="transition-colors hover:text-[#cdc4b7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </CardWrapper>
  );
}
