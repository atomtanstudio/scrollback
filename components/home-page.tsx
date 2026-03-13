"use client";

import { Suspense, useState } from "react";
import { SearchBar } from "@/components/search-bar";
import { StatPills } from "@/components/stat-pills";
import { FilterPills } from "@/components/filter-pills";
import { MasonryFeed } from "@/components/masonry-feed";
import type { ContentItemWithMedia } from "@/lib/db/types";

interface HomePageProps {
  initialItems: ContentItemWithMedia[];
  totalCount: number;
  stats: { total: number; tweets: number; threads: number; articles: number; art: number };
}

export function HomePage({ initialItems, totalCount, stats }: HomePageProps) {
  const [activeType, setActiveType] = useState("");

  return (
    <div className="relative z-10 max-w-[960px] mx-auto px-6">
      {/* Header */}
      <header className="flex items-center justify-between py-6">
        <div className="font-heading font-semibold text-[21px] tracking-tight text-[#f0f0f5] flex items-center">
          feed<span className="inline-block w-[5px] h-[5px] rounded-full bg-[var(--accent-thread)] mx-[1px] relative top-[1px]" />silo
        </div>
        <div className="text-[13px] text-[#555566]">{stats.total.toLocaleString()} captures</div>
      </header>

      {/* Hero */}
      <div className="flex flex-col items-center pt-20 pb-10 text-center">
        <h1 className="font-heading text-5xl font-extrabold tracking-[-1.8px] leading-[1.08] mb-3">
          Your digital<br />knowledge, searchable.
        </h1>
        <p className="text-[#8888aa] text-[17px] mb-10 max-w-[480px]">
          Capture tweets, threads, and articles. Find anything instantly with hybrid search.
        </p>

        <Suspense fallback={
          <div className="w-full max-w-[640px] h-14 rounded-[14px] bg-[#1a1a24] animate-pulse" />
        }>
          <SearchBar />
        </Suspense>

        <div className="mt-6">
          <StatPills stats={stats} />
        </div>

        <div className="mt-5">
          <FilterPills activeType={activeType} onTypeChange={setActiveType} />
        </div>
      </div>

      {/* Feed */}
      <div className="flex items-center justify-between mb-5 mt-12">
        <h2 className="font-heading text-xl font-semibold">Recent Captures</h2>
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
    </div>
  );
}
