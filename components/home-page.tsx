"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Pin, PinOff } from "lucide-react";
import { Header } from "@/components/header";
import { SearchBar } from "@/components/search-bar";
import { HomeCommandPalette } from "@/components/home-command-palette";
import { MasonryFeed } from "@/components/masonry-feed";
import { CardSkeletonGrid } from "@/components/card-skeleton";
import type { PinnedFilter, SuggestedPinnedFilter } from "@/lib/pinned-filters";

import type { ContentItemWithMedia } from "@/lib/db/types";

interface HomePageProps {
  initialItems: ContentItemWithMedia[];
  totalCount: number;
  initialHasMore: boolean;
  stats: { total: number; tweets: number; threads: number; articles: number; rss: number; art: number };
  initialPinnedFilters: PinnedFilter[];
  initialSuggestedFilters: SuggestedPinnedFilter[];
  isAuthed: boolean;
  isAdmin?: boolean;
  initialType?: string;
  initialSort?: string;
  initialTag?: string;
}

const VALID_TYPES = new Set(["tweet", "thread", "article", "rss", "art"]);
const VALID_SORTS = new Set(["recent", "most_liked", "most_viewed"]);

function buildUrl(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}

function buildTagUrl(tag: string, params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return `/tag/${encodeURIComponent(tag)}${qs ? `?${qs}` : ""}`;
}

function humanizeSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function HomePage({
  initialItems,
  totalCount,
  initialHasMore,
  stats,
  initialPinnedFilters,
  initialSuggestedFilters,
  isAuthed,
  isAdmin = false,
  initialType = "",
  initialSort = "recent",
  initialTag = "",
}: HomePageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read state from URL
  const urlType = searchParams.get("type") || initialType;
  const urlSort = searchParams.get("sort") || initialSort;
  const urlQ = searchParams.get("q") || "";
  const urlTag = searchParams.get("tag") || initialTag;

  const activeType = VALID_TYPES.has(urlType) ? urlType : "";
  const activeSort = VALID_SORTS.has(urlSort) ? urlSort : "recent";
  const activeTag = urlTag;

  const [searchResults, setSearchResults] = useState<ContentItemWithMedia[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState(urlQ);
  const [pinnedFilters, setPinnedFilters] = useState(initialPinnedFilters);
  const [suggestedFilters, setSuggestedFilters] = useState(initialSuggestedFilters);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const feedSectionRef = useRef<HTMLElement | null>(null);
  const feedHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const pendingPaletteScrollRef = useRef(false);

  // Re-run search when returning via back button with a query in URL
  const initialSearchDone = useRef(false);
  useEffect(() => {
    if (urlQ && !initialSearchDone.current) {
      initialSearchDone.current = true;
      setSearchQuery(urlQ);
      handleSearchDirect(urlQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPinnedFilters(initialPinnedFilters);
  }, [initialPinnedFilters]);

  useEffect(() => {
    setSuggestedFilters(initialSuggestedFilters);
  }, [initialSuggestedFilters]);

  const statEntries = [
    { label: "Tweets", count: stats.tweets, dot: "bg-[var(--accent-tweet)]" },
    { label: "Threads", count: stats.threads, dot: "bg-[var(--accent-thread)]" },
    { label: "Articles", count: stats.articles, dot: "bg-[var(--accent-article)]" },
    { label: "RSS", count: stats.rss, dot: "bg-[var(--accent-article)]" },
  ];

  const filters = [
    { label: "All", value: "" },
    { label: "Tweets", value: "tweet" },
    { label: "Threads", value: "thread" },
    { label: "Articles", value: "article" },
    { label: "RSS", value: "rss" },
  ];

  const recentItems = initialItems.slice(0, 3);

  const scrollToFeed = useCallback(() => {
    const target = feedHeadingRef.current || feedSectionRef.current;
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });
  }, []);

  const scheduleScrollToFeed = useCallback((delay = 140) => {
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollToFeed);
      });
    }, delay);
  }, [scrollToFeed]);

  const handleFilteredFeedReady = useCallback(() => {
    scheduleScrollToFeed(120);
  }, [scheduleScrollToFeed]);

  const applyFilter = useCallback(
    (type: string) => {
      setSearchResults(null);
      setSearchQuery("");
      router.push(buildUrl({ type, sort: activeSort, tag: "" }), { scroll: false });
      if (paletteOpen) {
        pendingPaletteScrollRef.current = true;
      } else {
        scheduleScrollToFeed();
      }
    },
    [paletteOpen, scheduleScrollToFeed, activeSort, router]
  );

  const openPinnedFilter = useCallback(
    (filter: PinnedFilter) => {
      setSearchResults(null);
      setSearchQuery("");

      if (filter.kind === "type") {
        router.push(buildUrl({ type: filter.value, sort: activeSort, tag: "" }), { scroll: false });
      } else {
        router.push(buildTagUrl(filter.value, { sort: activeSort }), { scroll: false });
      }

      if (paletteOpen) {
        pendingPaletteScrollRef.current = true;
      } else {
        scheduleScrollToFeed();
      }
    },
    [activeSort, paletteOpen, router, scheduleScrollToFeed]
  );

  const applySort = useCallback(
    (sort: string) => {
      setSearchResults(null);
      setSearchQuery("");
      router.push(buildUrl({ type: activeType, sort }), { scroll: false });
    },
    [activeType, router]
  );

  const handleSearchDirect = useCallback(async (query: string, options?: { scroll?: boolean }) => {
    setIsSearching(true);
    setSearchQuery(query);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&format=full&per_page=50&mode=keyword`
      );
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
      if (paletteOpen) {
        pendingPaletteScrollRef.current = true;
      } else if (options?.scroll) {
        scheduleScrollToFeed();
      }
    }
  }, [paletteOpen, scheduleScrollToFeed]);

  const handleSearch = useCallback(async (query: string, options?: { scroll?: boolean }) => {
    router.replace(buildUrl({ q: query }), { scroll: false });
    await handleSearchDirect(query, options);
  }, [router, handleSearchDirect]);

  const handleClearSearch = useCallback(() => {
    setSearchResults(null);
    setSearchQuery("");
    router.replace(buildUrl({ type: activeType, sort: activeSort }), { scroll: false });
  }, [router, activeType, activeSort]);

  useEffect(() => {
    const shouldIgnoreShortcut = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        target.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }

      if (event.key === "/" && !shouldIgnoreShortcut(event.target)) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (paletteOpen || !pendingPaletteScrollRef.current) return;
    pendingPaletteScrollRef.current = false;
    scheduleScrollToFeed(240);
  }, [paletteOpen, scheduleScrollToFeed]);

  const currentPinCandidate = useMemo<PinnedFilter | null>(() => {
    if (activeTag) {
      return { kind: "tag", value: activeTag, label: humanizeSlug(activeTag) };
    }
    if (activeType === "art") {
      return { kind: "type", value: "art", label: "Art" };
    }
    return null;
  }, [activeTag, activeType]);

  const currentPinActive = currentPinCandidate
    ? pinnedFilters.some(
        (filter) =>
          filter.kind === currentPinCandidate.kind && filter.value === currentPinCandidate.value
      )
    : false;

  const toggleCurrentPin = useCallback(async () => {
    if (!currentPinCandidate) return;

    const res = await fetch("/api/pinned-filters", {
      method: currentPinActive ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentPinCandidate),
    });

    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (data?.filters) {
      setPinnedFilters(data.filters);
      if (data?.suggestions) {
        setSuggestedFilters(data.suggestions);
      }
    }
  }, [currentPinActive, currentPinCandidate]);

  const addSuggestedPin = useCallback(async (filter: SuggestedPinnedFilter) => {
    const res = await fetch("/api/pinned-filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filter),
    });

    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (data?.filters) {
      setPinnedFilters(data.filters);
      if (data?.suggestions) {
        setSuggestedFilters(data.suggestions);
      } else {
        setSuggestedFilters((current) =>
          current.filter((candidate) => candidate.value !== filter.value)
        );
      }
    }
  }, []);

  const feedTitle = searchResults
    ? isSearching
      ? "Searching..."
      : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`
    : activeTag
      ? `Tagged: ${activeTag.replace(/-/g, " ")}`
    : activeType === "tweet"
      ? "Tweets"
      : activeType === "thread"
        ? "Threads"
        : activeType === "article"
          ? "Articles"
          : activeType === "rss"
            ? "RSS"
            : activeType === "art"
              ? "Art & Prompts"
              : activeSort === "most_liked"
                ? "Most Liked"
                : activeSort === "most_viewed"
                  ? "Most Viewed"
                  : "Latest Saves";
  const filteredTotalCount = searchResults
    ? searchResults.length
    : activeType === "tweet"
      ? stats.tweets
      : activeType === "thread"
        ? stats.threads
        : activeType === "article"
          ? stats.articles
          : activeType === "rss"
            ? stats.rss
          : activeType === "art"
            ? stats.art
            : totalCount;

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px] pb-16">
        <Header captureCount={stats.total} isAuthed={isAuthed} isAdmin={isAdmin} currentPath="/" />

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Sidebar */}
          <aside className="flex flex-col gap-4">
            <div className="rounded-[16px] border border-[#d6c9b214] bg-[#ffffff08] p-4">
              <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-[#a49b8b]">Filters</p>
              <div className="grid gap-1.5">
                {filters.map((filter) => {
                  const isActive = activeType === filter.value;
                  return (
                    <button
                      key={filter.value || "all"}
                      type="button"
                      onClick={() => applyFilter(filter.value)}
                      aria-pressed={isActive}
                      className={`flex items-center justify-between rounded-[12px] border px-3.5 py-2.5 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462] ${
                        isActive
                          ? "border-[#d6c9b242] bg-[#f2ede50a] text-[#f2ede5]"
                          : "border-transparent bg-transparent text-[#a49b8b] hover:bg-[#ffffff05] hover:text-[#f2ede5]"
                      }`}
                    >
                      <span>{filter.label}</span>
                      {filter.value && (
                        <span className="text-[12px] text-[#b89462]">
                          {statEntries.find((entry) => entry.label.toLowerCase() === filter.label.toLowerCase())?.count.toLocaleString()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {pinnedFilters.length > 0 && (
              <div className="rounded-[16px] border border-[#d6c9b214] bg-[#ffffff08] p-4">
                <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-[#a49b8b]">Pinned</p>
                <div className="grid gap-1.5">
                  {pinnedFilters.map((filter) => {
                    const isActive =
                      (filter.kind === "type" && activeType === filter.value) ||
                      (filter.kind === "tag" && activeTag === filter.value);

                    return (
                      <button
                        key={`${filter.kind}:${filter.value}`}
                        type="button"
                        onClick={() => openPinnedFilter(filter)}
                        aria-pressed={isActive}
                        className={`flex items-center justify-between rounded-[12px] border px-3.5 py-2.5 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462] ${
                          isActive
                            ? "border-[#d6c9b242] bg-[#f2ede50a] text-[#f2ede5]"
                            : "border-transparent bg-transparent text-[#a49b8b] hover:bg-[#ffffff05] hover:text-[#f2ede5]"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-art)]" />
                          {filter.label}
                        </span>
                        {filter.kind === "type" && filter.value === "art" ? (
                          <span className="text-[12px] text-[#b89462]">{stats.art.toLocaleString()}</span>
                        ) : (
                          <Pin className="h-3.5 w-3.5 text-[#b89462]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {suggestedFilters.length > 0 && (
              <div className="rounded-[16px] border border-[#b8946218] bg-[linear-gradient(180deg,rgba(184,148,98,0.08),rgba(255,255,255,0.02))] p-4">
                <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-[#b89462]">Suggested</p>
                <p className="mb-3 text-[11px] leading-4 text-[#8a8174]">
                  Topics you keep saving enough that they probably deserve a home.
                </p>
                <div className="grid gap-1.5">
                  {suggestedFilters.map((filter) => (
                    <div
                      key={`suggested:${filter.value}`}
                      className="flex items-center gap-2 rounded-[12px] border border-transparent bg-transparent px-1 py-1.5 text-left text-[13px] text-[#a49b8b] transition-colors hover:bg-[#ffffff05] hover:text-[#f2ede5]"
                    >
                      <button
                        type="button"
                        onClick={() => openPinnedFilter(filter)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-[10px] px-2.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[#f2ede5]">{filter.label}</span>
                          <span className="block text-[11px] text-[#8a8174]">
                            Saved {filter.count} times
                          </span>
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.08em] text-[#b89462]">
                          {filter.source}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void addSuggestedPin(filter)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#b8946233] bg-[#b894620f] text-[#b89462] transition-colors hover:bg-[#b894621d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
                        aria-label={`Pin ${filter.label}`}
                        title={`Pin ${filter.label}`}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[16px] border border-[#b8946222] bg-gradient-to-b from-[#b894620a] to-transparent p-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b89462]">Support our projects</p>
              <p className="mb-3 text-[11px] leading-4 text-[#8a8174]">Other tools from the maker of Scrollback</p>
              <div className="grid gap-2">
                <a
                  href="https://promptsilo.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors hover:bg-[#b894620a]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#b8946218] text-[11px]">PS</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#f2ede5] group-hover:text-white">Prompt Silo</p>
                    <p className="text-[10px] leading-3 text-[#7d7569]">AI prompt manager</p>
                  </div>
                </a>
                <a
                  href="https://personalab.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 transition-colors hover:bg-[#b894620a]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#b8946218] text-[11px]">PL</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#f2ede5] group-hover:text-white">Persona Lab</p>
                    <p className="text-[10px] leading-3 text-[#7d7569]">AI persona builder</p>
                  </div>
                </a>
              </div>
              <div className="mt-3 pt-2">
                <a
                  href="/waitlist"
                  className="flex items-center justify-center gap-1.5 rounded-[10px] border border-[#b8946222] bg-[#b894620a] px-3 py-2 text-[11px] font-medium text-[#b89462] transition-colors hover:bg-[#b8946218] hover:text-[#f0cf9f]"
                >
                  Join the waitlist for Scrollback Cloud
                </a>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div>
            {/* Compact intro + search */}
            <div className="mb-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-heading text-2xl font-semibold tracking-[-0.04em] text-[#f2ede5]">
                  Your Feed
                </h1>
                {/* Sort tabs */}
                <div className="flex items-center gap-1 rounded-[10px] border border-[#d6c9b214] bg-[#ffffff05] p-1">
                  {([
                    { label: "Latest", value: "recent" },
                    { label: "Most Liked", value: "most_liked" },
                    { label: "Most Viewed", value: "most_viewed" },
                  ] as const).map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => applySort(s.value)}
                      className={`cursor-pointer rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        activeSort === s.value
                          ? "bg-[#ffffff0a] text-[#f2ede5]"
                          : "text-[#8a8174] hover:text-[#cdc4b7]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <SearchBar
                onSearch={handleSearch}
                onClear={handleClearSearch}
                initialQuery={searchQuery}
              />
            </div>

            {/* Feed */}
            <section ref={feedSectionRef}>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <h2
                  ref={feedHeadingRef}
                  className="font-heading text-lg font-semibold tracking-[-0.03em] text-[#f2ede5]"
                >
                  {feedTitle}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#8a8174]">
                  {currentPinCandidate && (
                    <button
                      type="button"
                      onClick={() => void toggleCurrentPin()}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#b8946233] bg-[#b894620a] px-3 py-1 text-[12px] text-[#b89462] transition-colors hover:bg-[#b8946218]"
                    >
                      {currentPinActive ? (
                        <>
                          <PinOff className="h-3.5 w-3.5" />
                          Unpin
                        </>
                      ) : (
                        <>
                          <Pin className="h-3.5 w-3.5" />
                          Pin
                        </>
                      )}
                    </button>
                  )}
                  {searchQuery && searchResults && (
                    <span>for &ldquo;{searchQuery}&rdquo;</span>
                  )}
                  {activeTag && (
                    <button
                      type="button"
                      onClick={() => router.push(buildUrl({ type: activeType, sort: activeSort }), { scroll: false })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#b8946233] bg-[#b894620a] px-3 py-1 text-[12px] text-[#b89462] transition-colors hover:bg-[#b8946218]"
                    >
                      {activeTag.replace(/-/g, " ")}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                  <span>{filteredTotalCount.toLocaleString()} items</span>
                </div>
              </div>

              {searchResults ? (
                isSearching ? (
                  <CardSkeletonGrid />
                ) : searchResults.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-sm text-[#8a8174]">No results found</p>
                  </div>
                ) : (
                  <MasonryFeed
                    key={`search-${searchQuery}`}
                    initialItems={searchResults}
                    totalCount={searchResults.length}
                    disableLiveFetch
                  />
                )
              ) : (
                <MasonryFeed
                  key={`${activeType}-${activeTag}-${activeSort}`}
                  initialItems={initialItems}
                  totalCount={filteredTotalCount}
                  initialHasMore={initialHasMore}
                  type={activeType || undefined}
                  tag={activeTag || undefined}
                  sort={activeSort}
                  onInitialRenderReady={activeType || activeTag ? handleFilteredFeedReady : undefined}
                />
              )}
            </section>
          </div>
        </div>
      </div>

      <HomeCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        isAuthed={isAuthed}
        recentItems={recentItems}
        currentFilter={activeType}
        currentTag={activeTag}
        pinnedFilters={pinnedFilters}
        suggestedFilters={suggestedFilters}
        currentSearch={searchQuery}
        onApplyFilter={applyFilter}
        onApplySearch={handleSearch}
        onClearSearch={handleClearSearch}
      />
    </div>
  );
}
