"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/header";
import { SearchBar } from "@/components/search-bar";
import { StatPills } from "@/components/stat-pills";
import { FilterPills } from "@/components/filter-pills";
import { MasonryFeed } from "@/components/masonry-feed";
import { SearchResults } from "@/components/search-results";
import type { ContentItemWithMedia } from "@/lib/db/types";
import type { ScoredResult } from "@/lib/db/types";

interface HomePageProps {
  initialItems: ContentItemWithMedia[];
  totalCount: number;
  stats: { total: number; tweets: number; threads: number; articles: number; art: number };
}

export function HomePage({ initialItems, totalCount, stats }: HomePageProps) {
  const [activeType, setActiveType] = useState("");
  const [searchResults, setSearchResults] = useState<ScoredResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchResults(null);
  }, []);

  return (
    <div className="relative z-10 max-w-[1200px] mx-auto px-6">
      {/* Header */}
      <Header captureCount={stats.total} />

      {/* Hero */}
      <div className="flex flex-col items-center pt-20 pb-10 text-center">
        <h1 className="font-heading text-5xl font-extrabold tracking-[-1.8px] leading-[1.08] mb-3">
          Your digital<br />knowledge, searchable.
        </h1>
        <p className="text-[#8888aa] text-[17px] mb-10 max-w-[480px]">
          Capture tweets, threads, and articles. Find anything instantly with hybrid search.
        </p>

        <SearchBar onSearch={handleSearch} onClear={handleClearSearch} />

        <div className="mt-6">
          <StatPills stats={stats} />
        </div>

        {!searchResults && (
          <div className="mt-5">
            <FilterPills activeType={activeType} onTypeChange={setActiveType} />
          </div>
        )}
      </div>

      {searchResults ? (
        <SearchResults results={searchResults} isLoading={isSearching} />
      ) : (
        <>
          {/* Feed */}
          <div className="flex items-center justify-between mb-5 mt-12">
            <h2 className="font-heading text-xl font-semibold">
              {activeType === "tweet" ? "Tweets" : activeType === "thread" ? "Threads" : activeType === "article" ? "Articles" : activeType === "art" ? "Art & Prompts" : "Recent Captures"}
            </h2>
            <span className="text-[13px] text-[#555566]">
              {totalCount.toLocaleString()} items
            </span>
          </div>

          <div className="pb-16">
            <MasonryFeed
              key={activeType}
              initialItems={initialItems}
              totalCount={totalCount}
              type={activeType || undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}
