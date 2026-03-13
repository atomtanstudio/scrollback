"use client";

import { useEffect, useState } from "react";
import { ContentCard } from "@/components/cards/content-card";
import type { ContentItemWithMedia } from "@/lib/db/types";

interface RelatedItemsProps {
  itemId: string;
}

interface RelatedApiItem {
  id: string;
  source_type: string;
  title: string;
  body_text: string;
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
      className="min-w-[280px] max-w-[280px] flex-shrink-0 rounded-[14px] overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex-shrink-0"
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

export function RelatedItems({ itemId }: RelatedItemsProps) {
  const [items, setItems] = useState<ContentItemWithMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/items/${itemId}/related`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (!cancelled) {
          // The API returns a subset of ContentItem fields; cast via unknown to satisfy the type
          const mapped = (data.items as RelatedApiItem[]).map((item) => ({
            ...item,
            media_items: [],
          })) as unknown as ContentItemWithMedia[];
          setItems(mapped);
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
    <div>
      <h2 className="font-heading text-lg font-semibold text-[#f0f0f5] mb-4">
        More like this
      </h2>

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
              <div
                key={item.id}
                className="min-w-[280px] max-w-[280px] flex-shrink-0"
              >
                <ContentCard item={item} />
              </div>
            ))
          )}
        </div>

        {/* Fade gradient at right edge */}
        <div
          className="absolute pointer-events-none right-0 top-0 bottom-4"
          style={{
            width: 64,
            background:
              "linear-gradient(to right, transparent, rgb(10, 10, 18))",
          }}
        />
      </div>
    </div>
  );
}
