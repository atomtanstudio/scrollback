"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  ArrowRight,
  Sparkles,
  PanelTop,
  CircleDot,
} from "lucide-react";
import { getAttributionName, getDisplayBodyText, getDisplayTitle } from "@/lib/content-display";
import { formatTimeAgo } from "@/lib/format";
import type { ContentItemWithMedia } from "@/lib/db/types";

interface HomeCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthed: boolean;
  recentItems: ContentItemWithMedia[];
  currentFilter: string;
  currentSearch: string;
  onApplyFilter: (type: string) => void;
  onApplySearch: (query: string) => Promise<void>;
  onClearSearch: () => void;
}

interface SearchResultItem extends ContentItemWithMedia {
  media_items?: ContentItemWithMedia["media_items"];
}

interface PaletteAction {
  id: string;
  section: string;
  label: string;
  detail?: string;
  meta?: string;
  icon: "filter" | "search" | "jump" | "recent";
  tone?: "all" | "tweet" | "thread" | "article" | "rss" | "art";
  run: () => void;
}

function itemLabel(item: ContentItemWithMedia) {
  if (item.source_platform === "rss") return "RSS";
  if (item.source_type === "thread") return "Thread";
  if (item.source_type === "article") return "Article";
  if (
    item.source_type === "image_prompt" ||
    item.source_type === "video_prompt"
  ) {
    return "Art";
  }
  return "Tweet";
}

function truncate(value: string | null | undefined, max = 68) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function HomeCommandPalette({
  open,
  onOpenChange,
  isAuthed,
  recentItems,
  currentFilter,
  currentSearch,
  onApplyFilter,
  onApplySearch,
  onClearSearch,
}: HomeCommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(currentSearch);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMacLike, setIsMacLike] = useState(true);
  const selectedActionRef = useRef<HTMLButtonElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  const hotkeyLabel = isMacLike ? "⌘K" : "Ctrl K";

  useEffect(() => {
    if (!open) return;
    setQuery(currentSearch);
    setSelectedIndex(0);
    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => window.clearTimeout(timeout);
  }, [open, currentSearch]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      userAgentData?: { platform?: string };
    };
    const platform =
      nav.userAgentData?.platform || navigator.platform || navigator.userAgent;
    setIsMacLike(/mac|iphone|ipad|ipod/i.test(platform));
  }, []);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&format=full&per_page=8&mode=keyword`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (!controller.signal.aborted) {
          setResults(data.items || []);
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, open]);

  const actions = useMemo<PaletteAction[]>(() => {
    const items: PaletteAction[] = [];
    const trimmed = query.trim();

    items.push(
      {
        id: "filter-all",
        section: "Quick actions",
        label: "Show all saves",
        detail: "Reset the feed to the full library",
        meta: currentFilter || currentSearch ? "Reset" : "Current",
        icon: "filter",
        tone: "all",
        run: () => {
          onClearSearch();
          onApplyFilter("");
          onOpenChange(false);
        },
      },
      {
        id: "filter-tweets",
        section: "Quick actions",
        label: "Filter to tweets",
        detail: "Jump straight into single-post saves",
        meta: currentFilter === "tweet" ? "Current" : undefined,
        icon: "filter",
        tone: "tweet",
        run: () => {
          onApplyFilter("tweet");
          onOpenChange(false);
        },
      },
      {
        id: "filter-threads",
        section: "Quick actions",
        label: "Filter to threads",
        detail: "Show only multi-post chains",
        meta: currentFilter === "thread" ? "Current" : undefined,
        icon: "filter",
        tone: "thread",
        run: () => {
          onApplyFilter("thread");
          onOpenChange(false);
        },
      },
      {
        id: "filter-articles",
        section: "Quick actions",
        label: "Filter to articles",
        detail: "Long-form saves only",
        meta: currentFilter === "article" ? "Current" : undefined,
        icon: "filter",
        tone: "article",
        run: () => {
          onApplyFilter("article");
          onOpenChange(false);
        },
      },
      {
        id: "filter-rss",
        section: "Quick actions",
        label: "Filter to RSS",
        detail: "Imported feed items only",
        meta: currentFilter === "rss" ? "Current" : undefined,
        icon: "filter",
        tone: "rss",
        run: () => {
          onApplyFilter("rss");
          onOpenChange(false);
        },
      },
      {
        id: "filter-art",
        section: "Quick actions",
        label: "Filter to art",
        detail: "Image and video prompt saves",
        meta: currentFilter === "art" ? "Current" : undefined,
        icon: "filter",
        tone: "art",
        run: () => {
          onApplyFilter("art");
          onOpenChange(false);
        },
      }
    );

    if (trimmed) {
      items.unshift({
        id: "search-current-query",
        section: "Search",
        label: `Search for “${trimmed}”`,
        detail: "Apply the query to the library feed",
        icon: "search",
        run: async () => {
          await onApplySearch(trimmed);
          onOpenChange(false);
        },
      });
    }

    items.push({
      id: "jump-settings",
      section: "Navigate",
      label: "Open settings",
      detail: "Configure database, APIs, and extension pairing",
      icon: "jump",
      run: () => {
        onOpenChange(false);
        router.push("/settings");
      },
    });

    if (isAuthed) {
      items.push({
        id: "jump-admin",
        section: "Navigate",
        label: "Open admin",
        detail: "Review saves, edit items, and run bulk actions",
        icon: "jump",
        run: () => {
          onOpenChange(false);
          router.push("/admin");
        },
      });
    }

    for (const item of recentItems.slice(0, 4)) {
      items.push({
        id: `recent-${item.id}`,
        section: "Recent saves",
        label: truncate(getDisplayTitle(item) || item.prompt_text || getDisplayBodyText(item), 60) || "Untitled capture",
        detail: getAttributionName(item) || itemLabel(item),
        meta: formatTimeAgo(item.created_at),
        icon: "recent",
        run: () => {
          onOpenChange(false);
          router.push(`/item/${item.id}`);
        },
      });
    }

    for (const result of results) {
      items.push({
        id: `result-${result.id}`,
        section: searching ? "Searching" : "Search results",
        label:
          truncate(getDisplayTitle(result) || result.prompt_text || getDisplayBodyText(result), 68) ||
          "Untitled capture",
        detail:
          truncate(getDisplayBodyText(result) || result.prompt_text, 82) ||
          getAttributionName(result) ||
          itemLabel(result),
        meta: itemLabel(result),
        icon: "search",
        run: () => {
          onOpenChange(false);
          router.push(`/item/${result.id}`);
        },
      });
    }

    return items;
  }, [
    query,
    currentFilter,
    currentSearch,
    onClearSearch,
    onApplyFilter,
    onApplySearch,
    onOpenChange,
    isAuthed,
    recentItems,
    results,
    searching,
    router,
  ]);

  useEffect(() => {
    if (selectedIndex >= actions.length) {
      setSelectedIndex(0);
    }
  }, [selectedIndex, actions.length]);

  useLayoutEffect(() => {
    if (!open) return;
    const container = listContainerRef.current;
    const selectedNode = selectedActionRef.current;
    if (!container || !selectedNode) return;

    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;
    const nodeTop = selectedNode.offsetTop - 12;
    const nodeBottom = selectedNode.offsetTop + selectedNode.offsetHeight + 12;

    if (nodeTop < containerTop) {
      container.scrollTo({ top: Math.max(0, nodeTop), behavior: "auto" });
    } else if (nodeBottom > containerBottom) {
      container.scrollTo({
        top: Math.max(0, nodeBottom - container.clientHeight),
        behavior: "auto",
      });
    }
  }, [open, selectedIndex]);

  const groupedActions = useMemo(() => {
    const groups: Array<{ section: string; items: Array<PaletteAction & { index: number }> }> = [];
    actions.forEach((action, index) => {
      const last = groups[groups.length - 1];
      if (!last || last.section !== action.section) {
        groups.push({ section: action.section, items: [{ ...action, index }] });
      } else {
        last.items.push({ ...action, index });
      }
    });
    return groups;
  }, [actions]);

  const handleKeyDown = async (event: React.KeyboardEvent) => {
    if (!actions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((value) => (value + 1) % actions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((value) => (value - 1 + actions.length) % actions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      await actions[selectedIndex]?.run();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-hidden rounded-[30px] border border-[#d6c9b214] bg-[linear-gradient(180deg,rgba(22,28,36,0.98),rgba(14,18,24,0.99))] p-0 shadow-[0_34px_90px_rgba(2,6,12,0.55)] sm:max-w-[880px]">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search, switch filters, and jump through your library without leaving the page.
        </DialogDescription>

        <div className="border-b border-[#d6c9b214] px-5 py-4 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#a49b8b]">
                Command palette
              </p>
              <p className="mt-1 text-sm text-[#b4ab9d]">
                Search, switch categories, and jump without losing your place.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-[22px] border border-[#d6c9b233] bg-[#11161d] px-4 py-3 focus-within:border-[#d6c9b266]">
            <Search className="h-5 w-5 shrink-0 text-[#8a8174]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search saves, jump to admin, or switch categories..."
              className="h-8 flex-1 border-none bg-transparent text-[15px] text-[#f2ede5] outline-none placeholder:text-[#7d7569]"
            />
            <span className="hidden text-[11px] uppercase tracking-[0.16em] text-[#8a8174] md:inline">
              arrows + enter
            </span>
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setSelectedIndex(0);
                  onClearSearch();
                }}
                className="rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[#8a8174] transition-colors hover:text-[#f2ede5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div
          ref={listContainerRef}
          className="max-h-[58vh] overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4"
        >
          {groupedActions.map((group) => (
            <div key={group.section} className="mb-4 last:mb-0">
              <div className="px-2 pb-2 pt-1 text-[11px] uppercase tracking-[0.16em] text-[#8a8174]">
                {group.section}
              </div>
              <div className="grid gap-1">
                {group.items.map((action) => {
                  const selected = action.index === selectedIndex;
                  const filterToneClass =
                    action.tone === "tweet"
                      ? "bg-[var(--accent-tweet)]"
                      : action.tone === "thread"
                        ? "bg-[var(--accent-thread)]"
                        : action.tone === "article"
                          ? "bg-[var(--accent-article)]"
                          : action.tone === "rss"
                          ? "bg-[var(--accent-article)]"
                          : action.tone === "art"
                            ? "bg-[var(--accent-art)]"
                            : "bg-[#8a8174]";
                  return (
                    <button
                      key={action.id}
                      ref={selected ? selectedActionRef : null}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(action.index)}
                      onClick={() => void action.run()}
                    className={`flex w-full min-w-0 items-center justify-between gap-4 overflow-hidden rounded-[20px] border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462] ${
                        selected
                          ? "border-[#d6c9b242] bg-[#f2ede50a] shadow-[inset_0_0_0_1px_rgba(214,201,178,0.08)]"
                          : "border-transparent bg-transparent hover:border-[#d6c9b214] hover:bg-[#ffffff05]"
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                            action.icon === "filter"
                              ? "border-[rgba(140,127,159,0.22)] bg-[rgba(140,127,159,0.12)] text-[#c7bad6]"
                              : action.icon === "search"
                                ? "border-[rgba(184,148,98,0.22)] bg-[rgba(184,148,98,0.12)] text-[#e0c29c]"
                                : action.icon === "jump"
                                  ? "border-[rgba(110,152,160,0.22)] bg-[rgba(110,152,160,0.12)] text-[#b7d2d7]"
                                  : "border-[#d6c9b214] bg-[#ffffff05] text-[#cdc4b7]"
                          }`}
                        >
                          {action.icon === "filter" ? (
                            <span className="flex items-center gap-1">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${filterToneClass}`}
                              />
                              <CircleDot size={13} className="opacity-70" />
                            </span>
                          ) : action.icon === "search" ? (
                            <Sparkles size={15} />
                          ) : action.icon === "jump" ? (
                            <PanelTop size={15} />
                          ) : (
                            <ArrowRight size={15} />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[15px] font-medium text-[#f2ede5] [overflow-wrap:anywhere]">
                            {action.label}
                          </div>
                          {action.detail && (
                            <div className="mt-1 text-sm text-[#9c9387] [overflow-wrap:anywhere]">
                              {action.detail}
                            </div>
                          )}
                        </div>
                      </div>
                      {action.meta && (
                        <span className="max-w-[128px] shrink-0 truncate rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[#8a8174]">
                          {action.meta}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d6c9b214] px-5 py-3 text-[11px] uppercase tracking-[0.16em] text-[#8a8174]">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-3 py-2">
              Use ↑↓ to move
            </span>
            <span className="rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-3 py-2">
              Enter to select
            </span>
            <span className="rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-3 py-2">
              Esc to close
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-3 py-2">
              / to open
            </span>
            <span className="rounded-full border border-[#d6c9b214] bg-[#ffffff05] px-3 py-2">
              {hotkeyLabel} to open
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
