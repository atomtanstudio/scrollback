"use client";

import { CardWrapper } from "./card-wrapper";
import { formatTimeAgo } from "@/lib/format";
import type { ContentItem } from "@/lib/db/types";

interface ArticleCardProps {
  item: ContentItem & { media_items?: any[] };
}

export function ArticleCard({ item }: ArticleCardProps) {
  const thumbnail = item.media_items?.find((m: any) => m.media_type === "image");
  const sourceDomain = item.original_url
    ? new URL(item.original_url).hostname.replace("www.", "")
    : null;

  return (
    <CardWrapper type="article" noPadding>
      <div className="w-full h-[140px] rounded-t-[13px] overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
        {thumbnail?.stored_path || thumbnail?.original_url ? (
          <img src={thumbnail.stored_path || thumbnail.original_url} alt={thumbnail.alt_text || item.title} className="w-full h-full object-cover" />
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
