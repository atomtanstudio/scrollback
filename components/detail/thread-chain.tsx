"use client";

import { useMemo, useState } from "react";
import {
  getDisplayBodyText,
  getLanguageLabel,
  hasEnglishTranslation,
} from "@/lib/content-display";
import { formatTimeAgo } from "@/lib/format";
import { MediaRenderer } from "./media-renderer";
import { MediaLightbox } from "./media-lightbox";
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showOriginalCurrent, setShowOriginalCurrent] = useState(false);
  const currentHasTranslation = hasEnglishTranslation(currentItem);
  const currentBodyText = showOriginalCurrent
    ? currentItem.body_text || getDisplayBodyText(currentItem)
    : getDisplayBodyText(currentItem);

  const allEntries: ChainEntry[] = [
    {
      id: currentItem.id,
      isCurrent: true,
      author_display_name: currentItem.author_display_name,
      author_handle: currentItem.author_handle,
      author_avatar_url: currentItem.author_avatar_url,
      body_text: currentBodyText,
      posted_at: currentItem.posted_at,
      media_items: currentItem.media_items,
    },
    ...siblings.map((s) => ({
      id: s.id,
      isCurrent: false,
      author_display_name: s.author_display_name,
      author_handle: s.author_handle,
      author_avatar_url: s.author_avatar_url,
      body_text: getDisplayBodyText(s),
      posted_at: s.posted_at,
      media_items: s.media_items ?? [],
    })),
  ].sort((a, b) => {
    const aTime = a.posted_at ? new Date(a.posted_at).getTime() : 0;
    const bTime = b.posted_at ? new Date(b.posted_at).getTime() : 0;
    return aTime - bTime;
  });

  const totalCount = allEntries.length;
  const mediaStartOffsets = useMemo(() => {
    let offset = 0;
    return allEntries.map((entry) => {
      const start = offset;
      offset += entry.media_items?.length ?? 0;
      return start;
    });
  }, [allEntries]);
  const galleryItems = useMemo(
    () =>
      allEntries.flatMap((entry) =>
        (entry.media_items ?? []).map((item) => ({
          id: item.id,
          media_type: item.media_type,
          original_url: item.original_url,
          stored_path: item.stored_path,
          alt_text: item.alt_text,
          ai_description: item.ai_description,
        }))
      ),
    [allEntries]
  );

  return (
    <>
      <div className="rounded-[28px] border border-[#d6c9b214] bg-[linear-gradient(180deg,rgba(18,24,32,0.96),rgba(13,18,24,0.98))] p-5 sm:p-6">
        <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-[rgba(140,127,159,0.22)] bg-[rgba(140,127,159,0.12)] px-3.5 py-1.5 font-heading text-xs font-semibold text-[#c7bad6]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="5" stroke="#c7bad6" strokeWidth="1.2" />
            <circle cx="6" cy="6" r="2" fill="#c7bad6" />
          </svg>
          Thread &middot; {totalCount} post{totalCount !== 1 ? "s" : ""}
        </div>

        <div className="space-y-0">
          {allEntries.map((entry, index) => {
            const isLast = index === allEntries.length - 1;
            const initials = buildInitials(
              entry.author_display_name,
              entry.author_handle
            );
            const displayName =
              entry.author_display_name || entry.author_handle || "Unknown";
            const avatarSize = entry.isCurrent ? 42 : 36;
            const galleryStartIndex = mediaStartOffsets[index] ?? 0;

            return (
              <div key={entry.id} className="flex gap-4">
                <div className="flex w-12 shrink-0 flex-col items-center">
                  <div
                    className={`overflow-hidden rounded-full border ${
                      entry.isCurrent
                        ? "border-[rgba(140,127,159,0.26)] shadow-[0_0_0_4px_rgba(140,127,159,0.08)]"
                        : "border-[#d6c9b214] opacity-85"
                    }`}
                    style={{ width: avatarSize, height: avatarSize }}
                  >
                    {entry.author_avatar_url ? (
                      <img
                        src={entry.author_avatar_url}
                        alt={displayName}
                        width={avatarSize}
                        height={avatarSize}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#26313d,#534840)] text-sm font-bold text-[#f2ede5]">
                        {initials}
                      </div>
                    )}
                  </div>

                  {!isLast && (
                    <div className="mt-3 w-px flex-1 rounded-full bg-[linear-gradient(180deg,rgba(140,127,159,0.58),rgba(140,127,159,0.08))]" />
                  )}
                </div>

                <div className="min-w-0 flex-1" style={{ paddingBottom: isLast ? 0 : 24 }}>
                  {entry.isCurrent ? (
                    <div className="rounded-[24px] border border-[rgba(140,127,159,0.18)] bg-[#ffffff05] p-4 sm:p-5">
                      <div className="mb-3 flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#c7bad6]" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c7bad6]">
                          You&apos;re viewing this post
                        </span>
                      </div>

                      <div className="mb-3 flex items-center gap-2">
                        <span className="truncate font-heading text-sm font-semibold text-[#f2ede5]">
                          {displayName}
                        </span>
                        {entry.author_handle && (
                          <span className="truncate text-[12px] text-[#9c9387]">
                            @{entry.author_handle}
                          </span>
                        )}
                        {entry.posted_at && (
                          <>
                            <span className="text-[#7d7569] text-[12px]">
                              &middot;
                            </span>
                            <span className="shrink-0 text-[12px] text-[#7d7569]">
                              {formatTimeAgo(entry.posted_at)}
                            </span>
                          </>
                        )}
                      </div>

                      {entry.body_text && (
                        <>
                          {currentHasTranslation && (
                            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-[16px] border border-[#d6c9b214] bg-[#ffffff05] px-3.5 py-2.5">
                              <p className="text-[12px] text-[#b4ab9d]">
                                Translated from {getLanguageLabel(currentItem.language)}.
                              </p>
                              <button
                                type="button"
                                onClick={() => setShowOriginalCurrent((value) => !value)}
                                className="rounded-full border border-[#d6c9b214] bg-[#0f141b] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f2ede5] transition-colors hover:border-[#d6c9b233] hover:text-white"
                              >
                                {showOriginalCurrent ? "Show English" : "Show original"}
                              </button>
                            </div>
                          )}
                          <p className="whitespace-pre-wrap text-sm leading-[1.8] text-[#ddd4c7]">
                            {entry.body_text}
                          </p>
                        </>
                      )}

                      {entry.media_items && entry.media_items.length > 0 && (
                        <div className="mt-4">
                          <MediaRenderer
                            mediaItems={entry.media_items as DetailItem["media_items"]}
                            onMediaClick={(itemIndex) =>
                              setLightboxIndex(galleryStartIndex + itemIndex)
                            }
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border-l border-[#d6c9b214] pl-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="truncate font-heading text-sm font-semibold text-[#ddd4c7]">
                          {displayName}
                        </span>
                        {entry.author_handle && (
                          <span className="truncate text-[12px] text-[#9c9387]">
                            @{entry.author_handle}
                          </span>
                        )}
                        {entry.posted_at && (
                          <>
                            <span className="text-[#7d7569] text-[12px]">
                              &middot;
                            </span>
                            <span className="shrink-0 text-[12px] text-[#7d7569]">
                              {formatTimeAgo(entry.posted_at)}
                            </span>
                          </>
                        )}
                      </div>

                      {entry.body_text && (
                        <p
                          className="text-sm leading-[1.75] text-[#9c9387]"
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

                      {entry.media_items && entry.media_items.length > 0 && (
                        <div className="mt-3">
                          <MediaRenderer
                            mediaItems={entry.media_items as DetailItem["media_items"]}
                            onMediaClick={(itemIndex) =>
                              setLightboxIndex(galleryStartIndex + itemIndex)
                            }
                          />
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
      {lightboxIndex !== null && galleryItems.length > 0 && (
        <MediaLightbox
          mediaItems={galleryItems}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
