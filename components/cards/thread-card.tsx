"use client";

import { CardWrapper } from "./card-wrapper";
import { getDisplayBodyText } from "@/lib/content-display";
import { formatTimeAgo } from "@/lib/format";
import type { ContentItemWithMedia } from "@/lib/db/types";

interface ThreadCardProps {
  item: ContentItemWithMedia;
  href?: string;
}

export function ThreadCard({ item, href }: ThreadCardProps) {
  const displayBodyText = getDisplayBodyText(item);
  const initials = (item.author_display_name || item.author_handle || "??")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <CardWrapper type="thread" href={href}>
      <div className="mb-3 flex items-center gap-2.5">
        {item.author_avatar_url ? (
          <img
            src={item.author_avatar_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-9 w-9 shrink-0 rounded-full"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#202733] text-sm text-[#9c9387]">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[#f2ede5]">
            {item.author_display_name || item.author_handle}
          </div>
          {item.author_handle && (
            <div className="truncate text-xs text-[#7d7569]">
              @{item.author_handle.replace(/^@/, "")}
            </div>
          )}
        </div>
      </div>
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[rgba(140,127,159,0.24)] bg-[rgba(140,127,159,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c7bad6]">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        Thread
      </div>
      <p className="mb-3 text-sm leading-7 text-[#b4ab9d] line-clamp-3">
        {displayBodyText}
      </p>
      <div className="flex items-center justify-between text-xs text-[#7d7569]">
        <span>Captured {formatTimeAgo(item.created_at)}</span>
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
    </CardWrapper>
  );
}
