"use client";

interface AuthorCardProps {
  authorHandle: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  originalUrl: string | null;
  sourceType: string;
}

export function AuthorCard({
  authorHandle,
  authorDisplayName,
  authorAvatarUrl,
  originalUrl,
  sourceType,
}: AuthorCardProps) {
  const displayName = authorDisplayName || authorHandle || "Unknown";
  const initials = displayName.slice(0, 2).toUpperCase();

  const isXSource = sourceType === "tweet" || sourceType === "thread";
  const primaryLinkLabel = isXSource ? "View on X" : "Read Original Article";

  return (
    <div className="bg-[var(--surface)] border border-[hsl(var(--border))] rounded-[14px] p-5">
      {/* Avatar + name row */}
      <div className="flex items-center gap-3 mb-4">
        {authorAvatarUrl ? (
          <img
            src={authorAvatarUrl}
            alt={displayName}
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%)",
            }}
          >
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-heading font-semibold text-[14px] text-[#f0f0f5] truncate leading-tight">
            {displayName}
          </p>
          {authorHandle && (
            <p className="text-[12px] text-[#8888aa] truncate leading-tight mt-0.5">
              @{authorHandle}
            </p>
          )}
        </div>
      </div>

      {/* Link buttons */}
      <div className="flex flex-col gap-2">
        {originalUrl && (
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-[14px] py-[10px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-[10px] text-[#8888aa] hover:text-[#f0f0f5] transition-all text-[13px]"
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
            className="flex items-center gap-2 px-[14px] py-[10px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] rounded-[10px] text-[#8888aa] hover:text-[#f0f0f5] transition-all text-[13px]"
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
