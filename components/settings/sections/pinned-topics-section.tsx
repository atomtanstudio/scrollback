"use client";

import { useEffect, useMemo, useState } from "react";
import { Pin, PinOff } from "lucide-react";
import type { PinnedFilter, SuggestedPinnedFilter } from "@/lib/pinned-filters";

interface PinnedTopicsResponse {
  filters: PinnedFilter[];
  suggestions?: SuggestedPinnedFilter[];
}

function buildHref(filter: PinnedFilter) {
  if (filter.kind === "type") {
    return filter.value ? `/?type=${encodeURIComponent(filter.value)}` : "/";
  }
  return `/tag/${encodeURIComponent(filter.value)}`;
}

export function PinnedTopicsSection() {
  const [filters, setFilters] = useState<PinnedFilter[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedPinnedFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const pinnedTags = useMemo(
    () => filters.filter((filter) => filter.kind === "tag"),
    [filters]
  );

  const refresh = async () => {
    try {
      const res = await fetch("/api/pinned-filters");
      if (!res.ok) return;
      const data = (await res.json()) as PinnedTopicsResponse;
      setFilters(data.filters || []);
      setSuggestions(data.suggestions || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const mutate = async (method: "POST" | "DELETE", filter: PinnedFilter) => {
    const key = `${method}:${filter.kind}:${filter.value}`;
    setPendingKey(key);
    try {
      const res = await fetch("/api/pinned-filters", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filter),
      });
      if (!res.ok) return;
      const data = (await res.json()) as PinnedTopicsResponse;
      setFilters(data.filters || []);
      setSuggestions(data.suggestions || []);
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05] p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#d6c9b214] bg-[#0f141b]">
          <Pin className="h-[18px] w-[18px] text-[var(--accent-art)]" />
        </div>
        <div>
          <h3 className="font-heading text-[15px] font-semibold text-[#f2ede5]">
            Pinned Topics
          </h3>
          <p className="text-xs text-[#a49b8b]">
            Keep your most important recurring themes within one click.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div>
            <h4 className="text-sm font-medium text-[#f2ede5]">Pinned now</h4>
            <p className="mt-1 text-xs text-[#8a8174]">
              These stay in your sidebar and command palette.
            </p>
          </div>

          {loading ? (
            <div className="rounded-[16px] border border-[#d6c9b214] bg-[#0f141b] px-4 py-3 text-sm text-[#8a8174]">
              Loading pinned topics…
            </div>
          ) : filters.length > 0 ? (
            <div className="flex flex-col gap-2">
              {filters.map((filter) => {
                const key = `DELETE:${filter.kind}:${filter.value}`;
                return (
                  <div
                    key={`${filter.kind}:${filter.value}`}
                    className="flex items-center justify-between gap-3 rounded-[16px] border border-[#d6c9b214] bg-[#0f141b] px-4 py-3"
                  >
                    <a
                      href={buildHref(filter)}
                      className="min-w-0 flex-1"
                    >
                      <div className="truncate text-sm font-medium text-[#f2ede5]">
                        {filter.label}
                      </div>
                      <div className="text-xs text-[#8a8174]">
                        {filter.kind === "type" ? "Built-in feed" : "Pinned topic"}
                      </div>
                    </a>
                    <button
                      type="button"
                      onClick={() => void mutate("DELETE", filter)}
                      disabled={pendingKey === key}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#b8946233] bg-[#b894620a] px-3 py-1.5 text-[12px] text-[#b89462] transition-colors hover:bg-[#b8946218] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <PinOff className="h-3.5 w-3.5" />
                      Unpin
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[16px] border border-dashed border-[#d6c9b214] bg-[#0f141b] px-4 py-3 text-sm text-[#8a8174]">
              Nothing pinned yet. Save a topic from the feed or add one from suggestions.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <h4 className="text-sm font-medium text-[#f2ede5]">Suggested from your saves</h4>
            <p className="mt-1 text-xs text-[#8a8174]">
              FeedSilo watches for recurring capture themes so obvious interests bubble up.
            </p>
          </div>

          {loading ? (
            <div className="rounded-[16px] border border-[#d6c9b214] bg-[#0f141b] px-4 py-3 text-sm text-[#8a8174]">
              Scanning recurring topics…
            </div>
          ) : suggestions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {suggestions.map((filter) => {
                const key = `POST:${filter.kind}:${filter.value}`;
                return (
                  <div
                    key={`suggested:${filter.value}`}
                    className="flex items-center justify-between gap-3 rounded-[16px] border border-[#b8946218] bg-[linear-gradient(180deg,rgba(184,148,98,0.07),rgba(15,20,27,0.95))] px-4 py-3"
                  >
                    <a href={buildHref(filter)} className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[#f2ede5]">
                        {filter.label}
                      </div>
                      <div className="text-xs text-[#8a8174]">
                        Saved {filter.count} times via {filter.source}
                      </div>
                    </a>
                    <button
                      type="button"
                      onClick={() => void mutate("POST", filter)}
                      disabled={pendingKey === key}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#b8946233] bg-[#b894620f] px-3 py-1.5 text-[12px] text-[#b89462] transition-colors hover:bg-[#b894621d] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Pin className="h-3.5 w-3.5" />
                      Pin
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[16px] border border-dashed border-[#d6c9b214] bg-[#0f141b] px-4 py-3 text-sm text-[#8a8174]">
              Keep saving around the same topics and they’ll start appearing here.
              {pinnedTags.length > 0 ? " Existing pinned topics are already excluded." : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
