"use client";

import { ContentCard } from "@/components/cards/content-card";
import { CardSkeletonGrid } from "@/components/card-skeleton";
import { useEffect, useState, useCallback, useTransition, useRef, useLayoutEffect } from "react";
import { useInView } from "react-intersection-observer";
import type { ContentItemWithMedia } from "@/lib/db/types";

interface MasonryFeedProps {
  initialItems: ContentItemWithMedia[];
  totalCount: number;
  type?: string;
}

const GAP = 20;

export function MasonryFeed({ initialItems, totalCount: initialTotal, type }: MasonryFeedProps) {
  const [items, setItems] = useState(initialItems);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialItems.length < initialTotal);
  const [isPending, startTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number; width: number }>>(new Map());
  const [columnCount, setColumnCount] = useState(3);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const calculatedIdsRef = useRef<string>("");

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "1000px",
  });

  // Responsive column count
  const updateColumnCount = useCallback(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.offsetWidth;
    if (width < 640) setColumnCount(1);
    else if (width < 1024) setColumnCount(2);
    else if (width < 1400) setColumnCount(3);
    else if (width < 1800) setColumnCount(4);
    else setColumnCount(5);
  }, []);

  useEffect(() => {
    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);
    return () => window.removeEventListener("resize", updateColumnCount);
  }, [updateColumnCount]);

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

  // Load more via API with excludeIds
  const loadMore = useCallback(() => {
    if (!hasMore || isPending) return;

    startTransition(async () => {
      const loadedIds = items.map((i) => i.id);
      const params = new URLSearchParams({
        limit: "50",
        excludeIds: loadedIds.join(","),
      });
      if (type) params.set("type", type);

      const res = await fetch(`/api/items?${params}`);
      const data = await res.json();

      const newItems = data.items.filter(
        (item: any) => !loadedIds.includes(item.id)
      );

      setItems((prev) => [...prev, ...newItems]);
      setHasMore(data.hasMore);
      setTotalCount(data.totalCount);
    });
  }, [hasMore, isPending, items, type]);

  useEffect(() => {
    if (inView && hasMore && !isPending) loadMore();
  }, [inView, loadMore, hasMore, isPending]);

  // Reset on type filter change
  const prevTypeRef = useRef(type);
  useEffect(() => {
    if (prevTypeRef.current !== type) {
      prevTypeRef.current = type;
      setItems(initialItems);
      setHasMore(initialItems.length < initialTotal);
      setTotalCount(initialTotal);
      setPositions(new Map());
      calculatedIdsRef.current = "";
    }
  }, [type, initialItems, initialTotal]);

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

      {isPending && (
        <div className="mt-4">
          <CardSkeletonGrid count={6} />
        </div>
      )}

      {hasMore && <div ref={ref} className="h-4" />}

      {!hasMore && items.length > 0 && (
        <div className="flex justify-center py-8">
          <span className="text-sm text-[#555566]">You&apos;ve reached the end</span>
        </div>
      )}
    </>
  );
}
