"use client";

import Link from "next/link";
import { formatTimeAgo } from "@/lib/format";
import type { ScoredResult } from "@/lib/db/types";

interface SearchResultsProps {
  results: ScoredResult[];
  isLoading: boolean;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  tweet: { label: "Tweet", color: "var(--accent-tweet)" },
  thread: { label: "Thread", color: "var(--accent-thread)" },
  article: { label: "Article", color: "var(--accent-article)" },
  image_prompt: { label: "Art", color: "var(--accent-art)" },
  video_prompt: { label: "Art", color: "var(--accent-art)" },
};

export function SearchResults({ results, isLoading }: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="mt-8 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-[12px] bg-[#111118] border border-[#ffffff0a] p-4 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="mt-12 text-center pb-16">
        <p className="text-[#555566] text-sm">No results found</p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-3 pb-16">
      <p className="text-sm text-[#555566] mb-4">
        {results.length} result{results.length !== 1 ? "s" : ""}
      </p>
      {results.map((result) => {
        const config = typeConfig[result.source_type] || { label: result.source_type, color: "#8888aa" };
        return (
          <Link key={result.id} href={`/item/${result.id}`} className="block">
            <div className="rounded-[12px] bg-[#111118] border border-[#ffffff0a] p-4 hover:border-[#ffffff18] transition-all">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                  style={{ color: config.color, backgroundColor: `color-mix(in srgb, ${config.color} 12%, transparent)` }}
                >
                  {config.label}
                </span>
                {result.author_display_name && (
                  <span className="text-xs text-[#555566]">{result.author_display_name}</span>
                )}
                {result.posted_at && (
                  <span className="text-xs text-[#555566]">{formatTimeAgo(result.posted_at)}</span>
                )}
              </div>
              {result.title && result.title !== result.body_excerpt?.slice(0, 100) && (
                <h3 className="text-sm font-semibold text-[#f0f0f5] mb-1 line-clamp-1">{result.title}</h3>
              )}
              <p className="text-sm text-[#8888aa] line-clamp-2">{result.body_excerpt}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
