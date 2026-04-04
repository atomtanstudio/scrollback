"use client";

import { ContentCard } from "@/components/cards/content-card";
import { CardSkeletonGrid } from "@/components/card-skeleton";
import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import { useInView } from "react-intersection-observer";
import type { ContentItemWithMedia } from "@/lib/db/types";

interface MasonryFeedProps {
  initialItems: ContentItemWithMedia[];
  totalCount: number;
  initialHasMore?: boolean;
  type?: string;
  tag?: string;
  sort?: string;
  onInitialRenderReady?: () => void;
}

const GAP = 20;

function filterByType(items: ContentItemWithMedia[], type?: string): ContentItemWithMedia[] {
  if (!type) return items;
  if (type === "art") return items.filter(i => i.source_type === "image_prompt" || i.source_type === "video_prompt");
  if (type === "rss") return items.filter(i => i.source_platform === "rss");
  if (type === "article") return items.filter(i => i.source_type === "article" && i.source_platform !== "rss");
  return items.filter(i => i.source_type === type);
}

export function MasonryFeed({
  initialItems,
  totalCount: initialTotal,
  initialHasMore,
  type,
  tag,
  sort,
  onInitialRenderReady,
}: MasonryFeedProps) {
  const filteredInitialItems = filterByType(initialItems, type);
  const [items, setItems] = useState(() => filteredInitialItems);
  const [, setTotalCount] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore ?? (filteredInitialItems.length < initialTotal));
  const [isLoading, setIsLoading] = useState(false);
  const [hasMeasuredLayout, setHasMeasuredLayout] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number; width: number }>>(new Map());
  const [columnCount, setColumnCount] = useState(3);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const calculatedIdsRef = useRef<string>("");

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "400px",
  });
  const abortRef = useRef<AbortController | null>(null);
  const notifiedTypeRef = useRef<string | null>(null);

  // Responsive column count
  const updateColumnCount = useCallback(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.offsetWidth;
    if (width < 640) setColumnCount(1);
    else if (width < 860) setColumnCount(2);
    else setColumnCount(3);
  }, []);

  useEffect(() => {
    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);
    return () => window.removeEventListener("resize", updateColumnCount);
  }, [updateColumnCount]);

  useEffect(() => {
    const markInteracted = () => setHasUserInteracted(true);
    const markInteractedOnKey = (event: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", "End", " ", "j"].includes(event.key)) {
        setHasUserInteracted(true);
      }
    };

    window.addEventListener("wheel", markInteracted, { passive: true });
    window.addEventListener("touchmove", markInteracted, { passive: true });
    window.addEventListener("scroll", markInteracted, { passive: true });
    window.addEventListener("keydown", markInteractedOnKey);

    return () => {
      window.removeEventListener("wheel", markInteracted);
      window.removeEventListener("touchmove", markInteracted);
      window.removeEventListener("scroll", markInteracted);
      window.removeEventListener("keydown", markInteractedOnKey);
    };
  }, []);

  // Stable ref for item IDs
  const itemIdsRef = useRef<string[]>([]);
  itemIdsRef.current = items.map((item) => item.id);

  // Position calculation
  const calculatePositions = useCallback(() => {
    if (!containerRef.current || itemIdsRef.current.length === 0) return;

    const containerWidth = containerRef.current.offsetWidth;
    const columnWidth = (containerWidth - GAP * (columnCount - 1)) / columnCount;
    const columnHeights = new Array(columnCount).fill(0);
    const newPositions = new Map<string, { x: number; y: number; width: number }>();

    itemIdsRef.current.forEach((id) => {
      const element = itemRefs.current.get(id);
      if (!element) return;

      const shortestColumn = columnHeights.indexOf(Math.min(...columnHeights));
      const x = shortestColumn * (columnWidth + GAP);
      const y = columnHeights[shortestColumn];

      newPositions.set(id, { x, y, width: columnWidth });
      columnHeights[shortestColumn] = y + element.offsetHeight + GAP;
    });

    setPositions(newPositions);
    setContainerHeight(Math.max(...columnHeights));
    setHasMeasuredLayout(true);
  }, [columnCount]);

  const layoutKey = `${items.map((i) => i.id).join(",")}_${columnCount}`;

  useLayoutEffect(() => {
    if (calculatedIdsRef.current === layoutKey) return;
    const timer = setTimeout(() => {
      calculatePositions();
      calculatedIdsRef.current = layoutKey;
    }, 100);
    return () => clearTimeout(timer);
  }, [layoutKey, calculatePositions]);

  // Recalculate on image load (debounced)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let debounceTimer: NodeJS.Timeout | null = null;

    const handleImageLoad = (e: Event) => {
      if (e.target instanceof HTMLImageElement) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => calculatePositions(), 100);
      }
    };

    container.addEventListener("load", handleImageLoad, true);
    return () => {
      container.removeEventListener("load", handleImageLoad, true);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [calculatePositions]);

  // Cancel in-flight load-more requests on unmount (e.g. during navigation)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Load more via API with excludeIds
  const fetchPage = useCallback(async (excludeIds: string[], replace = false) => {
    // Abort any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "50",
        excludeIds: excludeIds.join(","),
      });
      if (type) params.set("type", type);
      if (tag) params.set("tag", tag);
      if (sort && sort !== "recent") params.set("sort", sort);

      const res = await fetch(`/api/items?${params}`, {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = await res.json();

      const newItems = data.items.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) => !excludeIds.includes(item.id)
      );

      if (newItems.length === 0) {
        if (replace) {
          setItems([]);
          setHasMeasuredLayout(false);
          setContainerHeight(0);
          setPositions(new Map());
        }
        setHasMore(false);
        return;
      }

      setHasMeasuredLayout(false);
      setItems((prev) => (replace ? newItems : [...prev, ...newItems]));
      setHasMore(Boolean(data.hasMore));
      setTotalCount(data.totalCount);
    } catch {
      // Silently ignore fetch errors (e.g. during page navigation/unload)
    } finally {
      setIsLoading(false);
    }
  }, [type, tag, sort]);

  const loadCooldownRef = useRef(false);
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || loadCooldownRef.current) return;
    loadCooldownRef.current = true;
    await fetchPage(items.map((i) => i.id));
    // Cooldown: wait for layout to settle before allowing another load
    setTimeout(() => { loadCooldownRef.current = false; }, 500);
  }, [fetchPage, hasMore, isLoading, items]);

  useEffect(() => {
    if (hasUserInteracted && hasMeasuredLayout && inView && hasMore && !isLoading && !loadCooldownRef.current) loadMore();
  }, [hasUserInteracted, hasMeasuredLayout, inView, loadMore, hasMore, isLoading]);

  // Reset on type, tag, or sort change
  const prevTypeRef = useRef(type);
  const prevTagRef = useRef(tag);
  const prevSortRef = useRef(sort);
  useEffect(() => {
    if (prevTypeRef.current !== type || prevTagRef.current !== tag || prevSortRef.current !== sort) {
      prevTypeRef.current = type;
      prevTagRef.current = tag;
      prevSortRef.current = sort;
      notifiedTypeRef.current = null;
      setItems(filteredInitialItems);
      setHasMore(initialHasMore ?? (filteredInitialItems.length < initialTotal));
      setTotalCount(initialTotal);
      setHasMeasuredLayout(false);
      setContainerHeight(0);
      setPositions(new Map());
      calculatedIdsRef.current = "";
    }
  }, [type, tag, sort, filteredInitialItems, initialHasMore, initialTotal]);

  useEffect(() => {
    if (!type && !tag && (!sort || sort === "recent")) return;
    void fetchPage([], true);
  }, [type, tag, sort, fetchPage]);

  useEffect(() => {
    if ((!type && !tag) || !onInitialRenderReady) return;
    const filterKey = `${type}-${tag}`;
    if (notifiedTypeRef.current === filterKey) return;
    if (isLoading || !hasMeasuredLayout || items.length === 0) return;
    notifiedTypeRef.current = filterKey;
    onInitialRenderReady();
  }, [type, tag, onInitialRenderReady, isLoading, hasMeasuredLayout, items.length]);

  const setItemRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="relative"
        style={{ height: containerHeight > 0 ? containerHeight : "auto" }}
      >
        {items.map((item) => {
          const pos = positions.get(item.id);
          return (
            <div
              key={item.id}
              ref={(el) => setItemRef(item.id, el)}
              style={
                pos
                  ? { position: "absolute", left: pos.x, top: pos.y, width: pos.width }
                  : { position: "absolute", opacity: 0, width: `calc((100% - ${GAP * (columnCount - 1)}px) / ${columnCount})` }
              }
            >
              <ContentCard item={item} />
            </div>
          );
        })}
      </div>

      {isLoading && (
        <div className="mt-4">
          <CardSkeletonGrid count={6} />
        </div>
      )}

      {hasMore && !isLoading && <div ref={ref} className="h-4" />}

      {!hasMore && items.length > 0 && (
        <div className="flex justify-center py-8">
          <span className="text-sm text-[#7d7569]">You&apos;ve reached the end</span>
        </div>
      )}
    </>
  );
}
