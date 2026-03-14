"use client";

import { CardWrapper } from "./card-wrapper";
import { VideoPoster } from "./video-poster";
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

  const initials = (item.author_display_name || item.author_handle || "??")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <CardWrapper type="tweet" noPadding={hasMedia} href={href}>
      {hasMedia && (() => {
        const url = getMediaDisplayUrl(media!.stored_path, media!.original_url);
        return (
          <div className="w-full h-[180px] rounded-t-[13px] overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e] relative">
            {media!.media_type === "video" ? (
              <VideoPoster
                src={url}
                alt={media!.alt_text || ""}
                className="w-full h-full object-cover object-top"
                fallbackClassName="w-full h-full bg-gradient-to-br from-[#1a1a2e] to-[#16213e]"
              />
            ) : (
              <img src={url} alt={media!.alt_text || ""} loading="lazy" decoding="async" className="w-full h-full object-cover object-top" />
            )}
            {media!.media_type === "video" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </div>
              </div>
            )}
          </div>
        );
      })()}
      <div className={hasMedia ? "px-5 py-3.5" : "p-5"}>
        <div className="flex items-center gap-2.5 mb-2.5">
          {item.author_avatar_url ? (
            <img src={item.author_avatar_url} alt="" loading="lazy" decoding="async" className="w-8 h-8 rounded-full flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2a2a3a] to-[#3a3a4a] flex-shrink-0 flex items-center justify-center text-xs text-[#555566]">
              {initials}
            </div>
          )}
          <div>
            <div className="font-semibold text-[13px] text-[#f0f0f5]">{item.author_display_name || item.author_handle}</div>
            {item.author_handle && (
              <div className="text-xs text-[#555566]">@{item.author_handle.replace(/^@/, "")}</div>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed text-[#8888aa] line-clamp-3 mb-2.5">{item.body_text}</p>
        <div className="flex items-center justify-between text-xs text-[#555566]">
          <span>Captured {formatTimeAgo(item.created_at)}</span>
          {item.original_url && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(item.original_url!, "_blank", "noopener,noreferrer"); }} className="hover:text-[#8888aa] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            </button>
          )}
        </div>
      </div>
    </CardWrapper>
  );
}
