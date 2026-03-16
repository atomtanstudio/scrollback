"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { SearchBar } from "@/components/search-bar";
import { HomeCommandPalette } from "@/components/home-command-palette";
import { MasonryFeed } from "@/components/masonry-feed";
import { CardSkeletonGrid } from "@/components/card-skeleton";
import { VideoPoster } from "@/components/cards/video-poster";
import { getDisplayBodyText, getDisplayTitle } from "@/lib/content-display";
import { formatTimeAgo } from "@/lib/format";
import { getMediaDisplayUrl } from "@/lib/media-url";
import { Command } from "lucide-react";
import type { ContentItemWithMedia } from "@/lib/db/types";

interface HomePageProps {
  initialItems: ContentItemWithMedia[];
  totalCount: number;
  initialHasMore: boolean;
  stats: { total: number; tweets: number; threads: number; articles: number; rss: number; art: number };
  isAuthed: boolean;
}

function isArtItem(item: ContentItemWithMedia) {
  return item.source_type === "image_prompt" || item.source_type === "video_prompt";
}

function getItemLabel(item: ContentItemWithMedia) {
  if (item.source_platform === "rss") return "RSS";
  if (item.source_type === "thread") return "Thread";
  if (item.source_type === "article") return "Article";
  if (isArtItem(item)) return item.source_type === "video_prompt" ? "Video Prompt" : "Image Prompt";
  return "Tweet";
}

function normalizeCardText(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/https?:\/\/t\.co\/\S+/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getItemTitle(item: ContentItemWithMedia) {
  const raw = normalizeCardText(
    getDisplayTitle(item) || item.prompt_text || getDisplayBodyText(item) || "Untitled capture"
  );
  return raw || "Untitled capture";
}

function getItemExcerpt(item: ContentItemWithMedia, max = 180) {
  const source = normalizeCardText(
    getDisplayBodyText(item) || item.prompt_text || getDisplayTitle(item) || ""
  );
  if (!source) return "Captured without body text.";
  return source.length > max ? `${source.slice(0, max - 1).trimEnd()}…` : source;
}

function getMedia(item: ContentItemWithMedia) {
  return item.media_items?.find((media) => media.media_type === "image" || media.media_type === "video") ?? null;
}

function getDomain(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

interface HomeFeatureCardProps {
  item: ContentItemWithMedia;
  eyebrow: string;
  className?: string;
  tall?: boolean;
}

function HomeFeatureCard({ item, eyebrow, className = "", tall = false }: HomeFeatureCardProps) {
  const media = getMedia(item);
  const mediaUrl = media ? getMediaDisplayUrl(media.stored_path, media.original_url) : null;

  return (
    <Link
      href={`/item/${item.id}`}
      className={`group rounded-[28px] border border-[#d6c9b214] bg-[#ffffff08] p-6 transition-colors hover:border-[#d6c9b233] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462] ${className}`}
    >
      <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">{eyebrow}</p>
      <h2
        className={`mt-3 max-w-[14ch] overflow-hidden font-heading text-[2rem] leading-[0.98] tracking-[-0.05em] text-[#f2ede5] [overflow-wrap:anywhere] group-hover:text-white ${
          tall ? "line-clamp-6" : "line-clamp-5"
        }`}
      >
        {getItemTitle(item)}
      </h2>

      {mediaUrl ? (
        <div className={`mt-5 overflow-hidden rounded-[22px] bg-[#171b22] ${tall ? "h-[208px]" : "h-[168px]"}`}>
          {media?.media_type === "video" ? (
            <VideoPoster
              src={mediaUrl}
              alt={media.alt_text || item.title || item.body_text || ""}
              className="h-full w-full object-cover object-top"
              fallbackClassName="h-full w-full bg-[linear-gradient(135deg,rgba(91,63,41,0.78),rgba(38,62,77,0.86))]"
            />
          ) : (
            <img
              src={mediaUrl}
              alt={media?.alt_text || item.title || item.body_text || ""}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-top"
            />
          )}
        </div>
      ) : null}

      <p className={`mt-4 text-[15px] leading-7 text-[#b4ab9d] [overflow-wrap:anywhere] ${tall ? "line-clamp-5" : "line-clamp-4"}`}>
        {getItemExcerpt(item, tall ? 180 : 144)}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-3 py-2 text-[12px] text-[#cdc4b7]">
          {getItemLabel(item)}
        </span>
        <span className="rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-3 py-2 text-[12px] text-[#cdc4b7]">
          {formatTimeAgo(item.created_at)}
        </span>
        {(item.author_display_name || item.author_handle) && (
          <span className="rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-3 py-2 text-[12px] text-[#cdc4b7]">
            {item.author_display_name || item.author_handle}
          </span>
        )}
      </div>
    </Link>
  );
}

export function HomePage({ initialItems, totalCount, initialHasMore, stats, isAuthed }: HomePageProps) {
  const [activeType, setActiveType] = useState("");
  const [searchResults, setSearchResults] = useState<ContentItemWithMedia[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const feedSectionRef = useRef<HTMLElement | null>(null);
  const feedHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const pendingPaletteScrollRef = useRef(false);

  const statEntries = [
    { label: "Tweets", count: stats.tweets, dot: "bg-[var(--accent-tweet)]" },
    { label: "Threads", count: stats.threads, dot: "bg-[var(--accent-thread)]" },
    { label: "Articles", count: stats.articles, dot: "bg-[var(--accent-article)]" },
    { label: "RSS", count: stats.rss, dot: "bg-[var(--accent-article)]" },
    { label: "Art", count: stats.art, dot: "bg-[var(--accent-art)]" },
  ];

  const filters = [
    { label: "All", value: "" },
    { label: "Tweets", value: "tweet" },
    { label: "Threads", value: "thread" },
    { label: "Articles", value: "article" },
    { label: "RSS", value: "rss" },
    { label: "Art", value: "art" },
  ];

  const recentItems = initialItems.slice(0, 3);
  const featuredVisual =
    initialItems.find((item) => item.source_type === "thread" && Boolean(getMedia(item))) ??
    initialItems.find((item) => isArtItem(item) && Boolean(getMedia(item))) ??
    initialItems.find((item) => item.source_type === "article" && Boolean(getMedia(item))) ??
    initialItems.find((item) => Boolean(getMedia(item))) ??
    initialItems[0] ??
    null;
  const usedFeatureIds = new Set<string>(featuredVisual ? [featuredVisual.id] : []);
  const featuredThread =
    initialItems.find((item) => item.source_type === "thread" && !usedFeatureIds.has(item.id)) ?? null;
  if (featuredThread) usedFeatureIds.add(featuredThread.id);
  const featuredArt =
    initialItems.find((item) => isArtItem(item) && !usedFeatureIds.has(item.id)) ?? null;
  if (featuredArt) usedFeatureIds.add(featuredArt.id);
  const featuredArticle =
    initialItems.find((item) => item.source_type === "article" && !usedFeatureIds.has(item.id)) ?? null;
  const strongestLane = statEntries.slice(1).reduce(
    (best, entry) => (entry.count > best.count ? entry : best),
    statEntries[0]
  );

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
      setActiveType(type);
      setSearchResults(null);
      setSearchQuery("");
      if (paletteOpen) {
        pendingPaletteScrollRef.current = true;
      } else {
        scheduleScrollToFeed();
      }
    },
    [paletteOpen, scheduleScrollToFeed]
  );

  const handleSearch = useCallback(async (query: string, options?: { scroll?: boolean }) => {
    setIsSearching(true);
    setActiveType("");
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

  const handleClearSearch = useCallback(() => {
    setSearchResults(null);
    setSearchQuery("");
  }, []);

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

  const feedTitle = searchResults
    ? isSearching
      ? "Searching..."
      : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`
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
              : "Recent Captures";
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
    <div className="relative z-10 mx-auto max-w-[1440px] px-4 pb-16 sm:px-6 lg:px-8">
      <Header captureCount={stats.total} isAuthed={isAuthed} currentPath="/" />

      <section className="overflow-hidden rounded-[32px] border border-[#d6c9b21a] bg-[linear-gradient(180deg,rgba(24,29,37,0.96),rgba(14,18,24,0.98))] shadow-[0_34px_90px_rgba(2,6,12,0.45)]">
        <div className="grid lg:grid-cols-[264px_minmax(0,1fr)]">
          <aside className="border-b border-[#d6c9b214] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] p-5 lg:border-b-0 lg:border-r lg:border-r-[#d6c9b214]">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff08] p-4">
                <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-[#a49b8b]">Filters</p>
                <div className="grid gap-2">
                  {filters.map((filter) => {
                    const isActive = activeType === filter.value;
                    return (
                      <button
                        key={filter.value || "all"}
                        type="button"
                        onClick={() => applyFilter(filter.value)}
                        aria-pressed={isActive}
                        className={`flex items-center justify-between rounded-[18px] border px-4 py-3 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462] ${
                          isActive
                            ? "border-[#d6c9b242] bg-[#f2ede50a] text-[#f2ede5]"
                            : "border-[#d6c9b214] bg-[#ffffff05] text-[#a49b8b] hover:border-[#d6c9b233] hover:text-[#f2ede5]"
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

              <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff08] p-4 sm:col-span-2 lg:col-span-1">
                <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-[#a49b8b]">Recently added</p>
                <div className="grid gap-3">
                  {recentItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/item/${item.id}`}
                      className="rounded-[18px] border border-[#d6c9b214] bg-[#ffffff05] px-4 py-3 transition-colors hover:border-[#d6c9b233] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
                    >
                      <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.12em] text-[#8a8174]">
                        <span>{getItemLabel(item)}</span>
                        <span>{formatTimeAgo(item.created_at)}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[14px] leading-6 text-[#cdc4b7] [overflow-wrap:anywhere]">
                        {getItemTitle(item)}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <div className="p-5 sm:p-6 lg:p-7">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_340px]">
              <div className="rounded-[28px] border border-[#d6c9b214] bg-[#ffffff08] p-6 sm:p-8">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">FeedSilo</p>
                <h1 className="mt-3 max-w-[10.5ch] font-heading text-[clamp(2.7rem,6vw,5rem)] font-semibold leading-[0.94] tracking-[-0.03em] text-[#f2ede5]">
                  Your feed, without the noise.
                </h1>
                <p className="mt-5 max-w-[58ch] text-[16px] leading-8 text-[#b4ab9d]">
                  {stats.total.toLocaleString()} captures across {stats.tweets.toLocaleString()} tweets,{" "}
                  {stats.threads.toLocaleString()} threads, {stats.articles.toLocaleString()} articles,{" "}
                  {stats.rss.toLocaleString()} RSS items, and {stats.art.toLocaleString()} art items. Search, filters, and review cues stay close without hiding the content.
                </p>
                <div className="mt-8">
                  <SearchBar onSearch={handleSearch} onClear={handleClearSearch} />
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPaletteOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-4 py-2 text-[12px] uppercase tracking-[0.16em] text-[#8a8174] transition-colors hover:border-[#d6c9b233] hover:text-[#f2ede5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
                  >
                    <Command size={14} />
                    Open palette
                  </button>
                </div>
              </div>

              <div className="grid gap-5">
                <div className="rounded-[28px] border border-[#d6c9b214] bg-[radial-gradient(circle_at_top_left,rgba(184,148,98,0.14),transparent_30%),rgba(255,255,255,0.05)] p-6">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">Library size</p>
                  <div className="mt-5 font-heading text-[clamp(4.5rem,8vw,6rem)] leading-none tracking-[-0.08em] text-[#f2ede5]">
                    {stats.total.toLocaleString()}
                  </div>
                  <p className="mt-4 text-[15px] leading-7 text-[#b4ab9d]">
                    Largest collection slice right now: {strongestLane.label.toLowerCase()} with {strongestLane.count.toLocaleString()} captures.
                  </p>
                </div>

                {featuredArticle ? (
                  <Link
                    href={`/item/${featuredArticle.id}`}
                    className="rounded-[28px] border border-[#d6c9b214] bg-[#ffffff08] p-6 transition-colors hover:border-[#d6c9b233] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
                  >
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">Latest article</p>
                    <h2 className="mt-3 line-clamp-3 font-heading text-[1.7rem] leading-[1] tracking-[-0.05em] text-[#f2ede5] [overflow-wrap:anywhere]">
                      {getItemTitle(featuredArticle)}
                    </h2>
                    <p className="mt-4 text-[15px] leading-7 text-[#b4ab9d]">{getItemExcerpt(featuredArticle, 118)}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {getDomain(featuredArticle.original_url) && (
                        <span className="rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-3 py-2 text-[12px] text-[#cdc4b7]">
                          {getDomain(featuredArticle.original_url)}
                        </span>
                      )}
                      <span className="rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-3 py-2 text-[12px] text-[#cdc4b7]">
                        {formatTimeAgo(featuredArticle.created_at)}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div className="rounded-[28px] border border-[#d6c9b214] bg-[#ffffff08] p-6">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">Latest article</p>
                    <p className="mt-4 text-[15px] leading-7 text-[#b4ab9d]">
                      No article in the current surface window.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-3">
              {featuredVisual ? <HomeFeatureCard item={featuredVisual} eyebrow="Featured capture" tall /> : null}
              {featuredThread ? <HomeFeatureCard item={featuredThread} eyebrow="Latest thread" /> : null}
              {featuredArt ? <HomeFeatureCard item={featuredArt} eyebrow="Latest art" /> : null}
            </div>

            <section
              ref={feedSectionRef}
              className="mt-6 rounded-[28px] border border-[#d6c9b214] bg-[#12161d]/70 p-5 sm:p-6"
            >
              <div className="mb-6 flex flex-col gap-3 border-b border-[#d6c9b214] pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">Library feed</p>
                  <h2
                    ref={feedHeadingRef}
                    className="mt-2 font-heading text-[1.85rem] font-semibold tracking-[-0.04em] text-[#f2ede5]"
                  >
                    {feedTitle}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#8a8174]">
                  {searchQuery && searchResults && (
                    <span>for &ldquo;{searchQuery}&rdquo;</span>
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
                  />
                )
              ) : (
                <MasonryFeed
                  key={activeType}
                  initialItems={initialItems}
                  totalCount={filteredTotalCount}
                  initialHasMore={initialHasMore}
                  type={activeType || undefined}
                  onInitialRenderReady={activeType ? handleFilteredFeedReady : undefined}
                />
              )}
            </section>
          </div>
        </div>
      </section>

      <HomeCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        isAuthed={isAuthed}
        recentItems={recentItems}
        currentFilter={activeType}
        currentSearch={searchQuery}
        onApplyFilter={applyFilter}
        onApplySearch={handleSearch}
        onClearSearch={handleClearSearch}
      />
    </div>
  );
}
