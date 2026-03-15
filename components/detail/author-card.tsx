"use client";

import { getAttributionName } from "@/lib/content-display";

interface AuthorCardProps {
  authorHandle: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  originalUrl: string | null;
  sourceType: string;
  sourcePlatform?: string | null;
  sourceLabel?: string | null;
  sourceDomain?: string | null;
}

export function AuthorCard({
  authorHandle,
  authorDisplayName,
  authorAvatarUrl,
  originalUrl,
  sourceType,
  sourcePlatform,
  sourceLabel,
  sourceDomain,
}: AuthorCardProps) {
  const displayName =
    getAttributionName({
      author_display_name: authorDisplayName,
      author_handle: authorHandle,
      source_platform: sourcePlatform,
      source_label: sourceLabel,
      source_domain: sourceDomain,
      original_url: originalUrl,
    }) || "Unknown";
  const initials = displayName.slice(0, 2).toUpperCase();

  const isXSource = sourceType === "tweet" || sourceType === "thread";
  const primaryLinkLabel = isXSource ? "View on X" : "Read Original Article";

  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff08] p-5">
      <div className="mb-4 flex items-center gap-3">
        {authorAvatarUrl ? (
          <img
            src={authorAvatarUrl}
            alt={displayName}
            width={40}
            height={40}
            className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-[#f2ede5]"
            style={{
              background: "linear-gradient(135deg, var(--accent-tweet) 0%, var(--accent-thread) 100%)",
            }}
          >
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-heading text-[14px] font-semibold leading-tight text-[#f2ede5]">
            {displayName}
          </p>
          {authorHandle && (
            <p className="mt-0.5 truncate text-[12px] leading-tight text-[#a49b8b]">
              @{authorHandle}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {originalUrl && (
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-[14px] border border-[#d6c9b214] bg-[#ffffff05] px-[14px] py-[10px] text-[13px] text-[#a49b8b] transition-colors hover:text-[#f2ede5]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            {primaryLinkLabel}
          </a>
        )}
        {authorHandle && isXSource && (
          <a
            href={`https://x.com/${authorHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-[14px] border border-[#d6c9b214] bg-[#ffffff05] px-[14px] py-[10px] text-[13px] text-[#a49b8b] transition-colors hover:text-[#f2ede5]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            View Profile
          </a>
        )}
      </div>
    </div>
  );
}
