"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDisplayBodyText, getDisplayTitle } from "@/lib/content-display";

interface RelatedItemsProps {
  itemId: string;
}

interface RelatedApiItem {
  id: string;
  source_type: string;
  title: string;
  body_text: string;
  translated_title?: string | null;
  translated_body_text?: string | null;
  author_handle: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  original_url: string | null;
  posted_at: string | Date | null;
  created_at: string | Date;
  similarity?: number;
}

function SkeletonCard() {
  return (
    <div
      className="min-w-[280px] max-w-[280px] flex-shrink-0 overflow-hidden rounded-[24px] border border-[#d6c9b214] bg-[#ffffff08]"
      style={{
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 flex-shrink-0 rounded-full"
            style={{ background: "rgba(255,255,255,0.07)" }}
          />
          <div className="space-y-1.5 flex-1">
            <div
              className="h-3 rounded"
              style={{ background: "rgba(255,255,255,0.07)", width: "60%" }}
            />
            <div
              className="h-2.5 rounded"
              style={{ background: "rgba(255,255,255,0.05)", width: "40%" }}
            />
          </div>
        </div>
        <div className="space-y-2">
          <div
            className="h-3 rounded"
            style={{ background: "rgba(255,255,255,0.07)", width: "100%" }}
          />
          <div
            className="h-3 rounded"
            style={{ background: "rgba(255,255,255,0.07)", width: "85%" }}
          />
          <div
            className="h-3 rounded"
            style={{ background: "rgba(255,255,255,0.05)", width: "65%" }}
          />
        </div>
      </div>
    </div>
  );
}

function formatTypeLabel(type: string) {
  if (type === "image_prompt") return "Image Prompt";
  if (type === "video_prompt") return "Video Prompt";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function buildExcerpt(item: RelatedApiItem) {
  const source = (getDisplayBodyText(item) || getDisplayTitle(item) || "").replace(/\s+/g, " ").trim();
  if (!source) return "Captured without preview text.";
  return source.length > 132 ? `${source.slice(0, 131).trimEnd()}…` : source;
}

function RelatedItemCard({ item }: { item: RelatedApiItem }) {
  const displayName = item.author_display_name || item.author_handle || "Unknown";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/item/${item.id}`}
      className="block min-w-[280px] max-w-[280px] flex-shrink-0 rounded-[24px] border border-[#d6c9b214] bg-[#ffffff08] p-5 transition-colors hover:border-[#d6c9b233]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-3 py-1 text-[11px] text-[#a49b8b]">
          {formatTypeLabel(item.source_type)}
        </span>
        {typeof item.similarity === "number" && (
          <span className="text-[11px] text-[#8a8174]">{Math.round(item.similarity * 100)}% match</span>
        )}
      </div>

      <h3 className="mt-4 line-clamp-3 font-heading text-[1.35rem] font-semibold leading-[1.02] tracking-[-0.04em] text-[#f2ede5]">
        {getDisplayTitle(item) || buildExcerpt(item)}
      </h3>

      <p className="mt-3 line-clamp-4 text-[14px] leading-6 text-[#b4ab9d]">
        {buildExcerpt(item)}
      </p>

      <div className="mt-5 flex items-center gap-3 border-t border-[#d6c9b214] pt-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(110,152,160,0.28),rgba(140,127,159,0.3))] text-[12px] font-semibold text-[#f2ede5]">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[#cdc4b7]">{displayName}</p>
          {item.author_handle && (
            <p className="truncate text-[12px] text-[#8a8174]">@{item.author_handle}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

export function RelatedItems({ itemId }: RelatedItemsProps) {
  const [items, setItems] = useState<RelatedApiItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/items/${itemId}/related`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (!cancelled) {
          setItems(data.items as RelatedApiItem[]);
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  // Don't render if no results (and not loading)
  if (!loading && items.length === 0) return null;

  return (
    <div className="rounded-[30px] border border-[#d6c9b214] bg-[linear-gradient(180deg,rgba(24,29,37,0.96),rgba(14,18,24,0.98))] p-6 shadow-[0_24px_64px_rgba(2,6,12,0.2)] sm:p-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">Related</p>
          <h2 className="mt-2 font-heading text-[1.7rem] font-semibold tracking-[-0.05em] text-[#f2ede5]">
            More like this
          </h2>
        </div>
      </div>

      <div className="relative">
        {/* Scrollable row */}
        <div
          className="flex gap-4 overflow-x-auto pb-4"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.1) transparent",
          }}
        >
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            items.map((item) => (
              <RelatedItemCard key={item.id} item={item} />
            ))
          )}
        </div>

        {/* Fade gradient at right edge */}
        <div
          className="absolute pointer-events-none right-0 top-0 bottom-4"
          style={{
            width: 64,
            background:
              "linear-gradient(to right, transparent, rgb(14, 18, 24))",
          }}
        />
      </div>
    </div>
  );
}
