"use client";

import { CardWrapper } from "./card-wrapper";
import { VideoPoster } from "./video-poster";
import { getDisplayBodyText, getDisplayTitle } from "@/lib/content-display";
import { formatTimeAgo } from "@/lib/format";
import { getMediaDisplayUrl } from "@/lib/media-url";
import type { ContentItemWithMedia } from "@/lib/db/types";

interface ArtCardProps {
  item: ContentItemWithMedia;
  href?: string;
}

export function ArtCard({ item, href }: ArtCardProps) {
  const displayTitle = getDisplayTitle(item);
  const displayBodyText = getDisplayBodyText(item);
  const image = item.media_items?.find(
    (m) => m.media_type === "image" || m.media_type === "video"
  );
  const hasImage = !!(image?.stored_path || image?.original_url);

  const initials = (item.author_display_name || item.author_handle || "??")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <CardWrapper type="art" noPadding={hasImage} href={href}>
      {hasImage && (
        <div className="relative flex h-[180px] w-full items-center justify-center overflow-hidden rounded-t-[23px] bg-[#19161d]">
          {image!.media_type === "video" ? (
            <VideoPoster
              src={getMediaDisplayUrl(image!.stored_path, image!.original_url)}
              alt={image!.alt_text || displayTitle}
              className="h-full w-full object-cover object-top"
              fallbackClassName="h-full w-full bg-[#19161d]"
            />
          ) : (
            <img
              src={getMediaDisplayUrl(image!.stored_path, image!.original_url)}
              alt={image!.alt_text || displayTitle}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-top"
            />
          )}
          {image!.media_type === "video" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            </div>
          )}
          {item.prompt_type && (
            <div className="absolute right-3 top-3 rounded-full border border-[rgba(182,111,120,0.28)] bg-[rgba(22,18,24,0.76)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#dfb3b9]">
              {item.prompt_type === "image" ? "Image" : "Video"} Prompt
            </div>
          )}
        </div>
      )}
      <div className={hasImage ? "px-5 py-4" : "p-5"}>
        {!hasImage && item.prompt_type && (
          <div className="mb-3 inline-flex rounded-full border border-[rgba(182,111,120,0.28)] bg-[rgba(182,111,120,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#dfb3b9]">
            {item.prompt_type === "image" ? "Image" : "Video"} Prompt
          </div>
        )}
        {item.prompt_text && (
          <p className="mb-3 text-[13px] italic leading-7 text-[#c8a7ac] line-clamp-2">
            &ldquo;{item.prompt_text}&rdquo;
          </p>
        )}
        {displayBodyText && !item.prompt_text && (
          <p className="mb-3 text-sm leading-7 text-[#b4ab9d] line-clamp-2">
            {displayBodyText}
          </p>
        )}
        <div className="mb-3 flex items-center gap-2">
          {item.author_avatar_url ? (
            <img
              src={item.author_avatar_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-7 w-7 shrink-0 rounded-full"
            />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#202733] text-[11px] text-[#9c9387]">
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
        <div className="text-xs text-[#7d7569]">
          Saved {formatTimeAgo(item.created_at)}
        </div>
      </div>
    </CardWrapper>
  );
}
