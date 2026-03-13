"use client";

import { CardWrapper } from "./card-wrapper";
import { formatTimeAgo } from "@/lib/format";
import type { ContentItemWithMedia } from "@/lib/db/types";

interface ArtCardProps {
  item: ContentItemWithMedia;
}

export function ArtCard({ item }: ArtCardProps) {
  const image = item.media_items?.find((m) => m.media_type === "image" || m.media_type === "video");
  const hasImage = !!(image?.stored_path || image?.original_url);

  const initials = (item.author_display_name || item.author_handle || "??")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <CardWrapper type="art" noPadding={hasImage}>
      {hasImage && (
        <div className="w-full h-[180px] rounded-t-[13px] overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#1a1028] to-[#201430] relative">
          <img src={image!.stored_path || image!.original_url} alt={image!.alt_text || item.title} className="w-full h-full object-cover" />
          {item.prompt_type && (
            <div className="absolute top-2.5 right-2.5 bg-[#0e101890] backdrop-blur-md border border-[#ec489940] rounded-md px-2 py-0.5 text-[11px] text-[var(--accent-art)] font-medium">
              {item.prompt_type === "image" ? "Image" : "Video"} Prompt
            </div>
          )}
        </div>
      )}
      <div className={hasImage ? "px-5 py-3.5" : "p-5"}>
        {!hasImage && item.prompt_type && (
          <div className="inline-block bg-[#0e101890] border border-[#ec489940] rounded-md px-2 py-0.5 text-[11px] text-[var(--accent-art)] font-medium mb-2.5">
            {item.prompt_type === "image" ? "Image" : "Video"} Prompt
          </div>
        )}
        {item.prompt_text && (
          <p className="text-[13px] text-[#8888aa] italic line-clamp-2 mb-2 before:content-['\201C'] before:text-[var(--accent-art)] after:content-['\201D'] after:text-[var(--accent-art)]">
            {item.prompt_text}
          </p>
        )}
        <div className="flex items-center gap-2 mb-2">
          {item.author_avatar_url ? (
            <img src={item.author_avatar_url} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2a2a3a] to-[#3a3a4a] flex-shrink-0 flex items-center justify-center text-[11px] text-[#555566]">
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
        <div className="flex items-center justify-between text-xs text-[#555566]">
          <span>Captured {formatTimeAgo(item.created_at)}</span>
        </div>
      </div>
    </CardWrapper>
  );
}
