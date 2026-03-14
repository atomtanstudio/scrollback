"use client";

import { CardWrapper } from "./card-wrapper";
import { formatTimeAgo } from "@/lib/format";
import type { ContentItemWithMedia } from "@/lib/db/types";

interface ThreadCardProps {
  item: ContentItemWithMedia;
  href?: string;
}

export function ThreadCard({ item, href }: ThreadCardProps) {
  const initials = (item.author_display_name || item.author_handle || "??")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <CardWrapper type="thread" href={href}>
      <div className="flex items-center gap-2.5 mb-3">
        {item.author_avatar_url ? (
          <img src={item.author_avatar_url} alt="" className="w-9 h-9 rounded-full flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2a2a3a] to-[#3a3a4a] flex-shrink-0 flex items-center justify-center text-sm text-[#555566]">
            {initials}
          </div>
        )}
        <div>
          <div className="font-semibold text-sm text-[#f0f0f5]">{item.author_display_name || item.author_handle}</div>
          {item.author_handle && (
            <div className="text-xs text-[#555566]">@{item.author_handle.replace(/^@/, "")}</div>
          )}
        </div>
      </div>
      <div className="text-xs text-[var(--accent-thread)] mb-2 flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        Thread
      </div>
      <p className="text-sm leading-relaxed text-[#8888aa] line-clamp-3 mb-3">{item.body_text}</p>
      <div className="flex items-center justify-between text-xs text-[#555566]">
        <span>Captured {formatTimeAgo(item.created_at)}</span>
        {item.original_url && (
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(item.original_url!, "_blank", "noopener,noreferrer"); }} className="hover:text-[#8888aa] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
          </button>
        )}
      </div>
    </CardWrapper>
  );
}
