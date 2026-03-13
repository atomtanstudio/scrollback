"use client";

import { formatTimeAgo } from "@/lib/format";
import { MediaRenderer } from "./media-renderer";
import type { DetailItem } from "@/lib/db/types";
import type { ContentItemWithMedia } from "@/lib/db/types";

type ThreadSibling = ContentItemWithMedia;

interface ThreadChainProps {
  currentItem: DetailItem;
  siblings: ThreadSibling[];
}

interface ChainEntry {
  id: string;
  isCurrent: boolean;
  author_display_name: string | null;
  author_handle: string | null;
  author_avatar_url: string | null;
  body_text: string;
  posted_at: Date | string | null;
  media_items: DetailItem["media_items"] | ContentItemWithMedia["media_items"];
}

function buildInitials(displayName: string | null, handle: string | null): string {
  const name = displayName || handle || "??";
  return name.slice(0, 2).toUpperCase();
}

export function ThreadChain({ currentItem, siblings }: ThreadChainProps) {
  // Combine current item + siblings, sort by posted_at ascending
  const allEntries: ChainEntry[] = [
    {
      id: currentItem.id,
      isCurrent: true,
      author_display_name: currentItem.author_display_name,
      author_handle: currentItem.author_handle,
      author_avatar_url: currentItem.author_avatar_url,
      body_text: currentItem.body_text,
      posted_at: currentItem.posted_at,
      media_items: currentItem.media_items,
    },
    ...siblings.map((s) => ({
      id: s.id,
      isCurrent: false,
      author_display_name: s.author_display_name,
      author_handle: s.author_handle,
      author_avatar_url: s.author_avatar_url,
      body_text: s.body_text,
      posted_at: s.posted_at,
      media_items: s.media_items ?? [],
    })),
  ].sort((a, b) => {
    const aTime = a.posted_at ? new Date(a.posted_at).getTime() : 0;
    const bTime = b.posted_at ? new Date(b.posted_at).getTime() : 0;
    return aTime - bTime;
  });

  const totalCount = allEntries.length;

  return (
    <div>
      {/* Thread label */}
      <div className="inline-flex items-center gap-1.5 bg-[rgba(167,139,250,0.1)] border border-[rgba(167,139,250,0.2)] text-[#a78bfa] font-heading text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="5" stroke="#a78bfa" strokeWidth="1.5" />
          <circle cx="6" cy="6" r="2" fill="#a78bfa" />
        </svg>
        Thread &middot; {totalCount} post{totalCount !== 1 ? "s" : ""}
      </div>

      {/* Thread items */}
      <div className="space-y-0">
        {allEntries.map((entry, index) => {
          const isLast = index === allEntries.length - 1;
          const initials = buildInitials(entry.author_display_name, entry.author_handle);
          const displayName = entry.author_display_name || entry.author_handle || "Unknown";
          const avatarSize = entry.isCurrent ? 42 : 36;

          return (
            <div key={entry.id} className="flex gap-3">
              {/* Left connector column */}
              <div
                className="flex flex-col items-center flex-shrink-0"
                style={{ width: 48 }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: "50%",
                    flexShrink: 0,
                    overflow: "hidden",
                    boxShadow: entry.isCurrent
                      ? "0 0 0 3px rgba(167,139,250,0.2)"
                      : undefined,
                    opacity: entry.isCurrent ? 1 : 0.7,
                  }}
                >
                  {entry.author_avatar_url ? (
                    <img
                      src={entry.author_avatar_url}
                      alt={displayName}
                      width={avatarSize}
                      height={avatarSize}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background:
                          "linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%)",
                        color: "white",
                        fontSize: entry.isCurrent ? 14 : 12,
                        fontWeight: 700,
                      }}
                    >
                      {initials}
                    </div>
                  )}
                </div>

                {/* Connecting line (not after last item) */}
                {!isLast && (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 24,
                      marginTop: 4,
                      background:
                        "linear-gradient(to bottom, #a78bfa, rgba(167,139,250,0.15))",
                      borderRadius: 1,
                    }}
                  />
                )}
              </div>

              {/* Right content column */}
              <div className="flex-1 min-w-0" style={{ paddingBottom: isLast ? 0 : 24 }}>
                {entry.isCurrent ? (
                  /* Highlighted current item */
                  <div className="bg-[rgba(167,139,250,0.04)] border border-[rgba(167,139,250,0.1)] rounded-xl p-4 -ml-1">
                    {/* Current item indicator */}
                    <div className="flex items-center gap-1.5 mb-3">
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          backgroundColor: "#a78bfa",
                          flexShrink: 0,
                        }}
                      />
                      <span className="text-[11px] text-[#a78bfa] font-semibold">
                        You&apos;re viewing this post
                      </span>
                    </div>

                    {/* Author row */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-heading font-semibold text-sm text-[#f0f0f5] truncate">
                        {displayName}
                      </span>
                      {entry.author_handle && (
                        <span className="text-[12px] text-[#8888aa] truncate">
                          @{entry.author_handle}
                        </span>
                      )}
                      {entry.posted_at && (
                        <>
                          <span className="text-[#555566] text-[12px]">&middot;</span>
                          <span className="text-[12px] text-[#555566] flex-shrink-0">
                            {formatTimeAgo(entry.posted_at)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Body text - full, no clamp */}
                    {entry.body_text && (
                      <p className="text-sm leading-[1.7] text-[#d8d8e8] whitespace-pre-wrap">
                        {entry.body_text}
                      </p>
                    )}

                    {/* Media */}
                    {entry.media_items && entry.media_items.length > 0 && (
                      <div className="mt-3">
                        <MediaRenderer mediaItems={entry.media_items as DetailItem["media_items"]} />
                      </div>
                    )}
                  </div>
                ) : (
                  /* Non-current (sibling) items */
                  <div>
                    {/* Author row */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-heading font-semibold text-sm text-[#d8d8e8] truncate">
                        {displayName}
                      </span>
                      {entry.author_handle && (
                        <span className="text-[12px] text-[#8888aa] truncate">
                          @{entry.author_handle}
                        </span>
                      )}
                      {entry.posted_at && (
                        <>
                          <span className="text-[#555566] text-[12px]">&middot;</span>
                          <span className="text-[12px] text-[#555566] flex-shrink-0">
                            {formatTimeAgo(entry.posted_at)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Body text - condensed, dimmed */}
                    {entry.body_text && (
                      <p
                        className="text-sm leading-[1.7] text-[#8888aa]"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {entry.body_text}
                      </p>
                    )}

                    {/* Media (compact) */}
                    {entry.media_items && entry.media_items.length > 0 && (
                      <div className="mt-2">
                        <MediaRenderer mediaItems={entry.media_items as DetailItem["media_items"]} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
