export type PinnedFilterKind = "type" | "tag";

export interface PinnedFilter {
  kind: PinnedFilterKind;
  value: string;
  label: string;
}

export interface SuggestedPinnedFilter extends PinnedFilter {
  count: number;
  source: "tag" | "category";
}

interface TopicSignal {
  slug: string;
  label: string;
  source: "tag" | "category";
}

const DEFAULT_PINNED_FILTERS: PinnedFilter[] = [
  { kind: "type", value: "art", label: "Art" },
];

const VALID_TYPE_FILTERS = new Set(["art", "tweet", "thread", "article", "rss"]);
const NOISY_TOPIC_SLUGS = new Set([
  "art",
  "article",
  "articles",
  "image",
  "image-prompt",
  "images",
  "prompt",
  "prompts",
  "rss",
  "thread",
  "threads",
  "tweet",
  "tweets",
  "video",
  "video-prompt",
  "videos",
  "x",
  "twitter",
]);

function humanizeSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function samePinnedFilter(a: PinnedFilter, b: PinnedFilter): boolean {
  return a.kind === b.kind && a.value === b.value;
}

export function normalizePinnedFilter(input: unknown): PinnedFilter | null {
  if (!input || typeof input !== "object") return null;

  const maybeFilter = input as Partial<PinnedFilter>;
  const kind = maybeFilter.kind;
  const rawValue = typeof maybeFilter.value === "string" ? maybeFilter.value.trim() : "";
  const rawLabel = typeof maybeFilter.label === "string" ? maybeFilter.label.trim() : "";

  if (kind !== "type" && kind !== "tag") return null;
  if (!rawValue) return null;
  if (kind === "type" && !VALID_TYPE_FILTERS.has(rawValue)) return null;

  return {
    kind,
    value: rawValue,
    label: rawLabel || humanizeSlug(rawValue),
  };
}

export function parsePinnedFilters(raw: string | null | undefined): PinnedFilter[] {
  if (raw == null || raw.trim() === "") {
    return [...DEFAULT_PINNED_FILTERS];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_PINNED_FILTERS];

    const normalized = parsed
      .map(normalizePinnedFilter)
      .filter((filter): filter is PinnedFilter => filter !== null);

    return normalized.filter(
      (filter, index) =>
        normalized.findIndex((candidate) => samePinnedFilter(candidate, filter)) === index
    );
  } catch {
    return [...DEFAULT_PINNED_FILTERS];
  }
}

export function serializePinnedFilters(filters: PinnedFilter[]): string {
  const normalized = filters
    .map(normalizePinnedFilter)
    .filter((filter): filter is PinnedFilter => filter !== null);

  const unique = normalized.filter(
    (filter, index) =>
      normalized.findIndex((candidate) => samePinnedFilter(candidate, filter)) === index
  );

  return JSON.stringify(unique);
}

export function addPinnedFilter(
  currentFilters: PinnedFilter[],
  nextFilter: PinnedFilter
): PinnedFilter[] {
  if (currentFilters.some((filter) => samePinnedFilter(filter, nextFilter))) {
    return currentFilters;
  }
  return [...currentFilters, nextFilter];
}

export function removePinnedFilter(
  currentFilters: PinnedFilter[],
  filterToRemove: PinnedFilter
): PinnedFilter[] {
  return currentFilters.filter((filter) => !samePinnedFilter(filter, filterToRemove));
}

export function rankSuggestedPinnedFilters(
  items: TopicSignal[][],
  currentFilters: PinnedFilter[],
  options?: { minCount?: number; limit?: number }
): SuggestedPinnedFilter[] {
  const pinnedValues = new Set(
    currentFilters
      .filter((filter) => filter.kind === "tag")
      .map((filter) => filter.value.toLowerCase())
  );
  const counts = new Map<string, SuggestedPinnedFilter>();

  for (const itemSignals of items) {
    const seenInItem = new Set<string>();
    for (const signal of itemSignals) {
      const slug = signal.slug.trim().toLowerCase();
      if (!slug || NOISY_TOPIC_SLUGS.has(slug) || pinnedValues.has(slug) || seenInItem.has(slug)) {
        continue;
      }
      seenInItem.add(slug);

      const existing = counts.get(slug);
      if (existing) {
        existing.count += 1;
        if (signal.source === "category" && existing.source !== "category") {
          existing.label = signal.label;
          existing.source = "category";
        }
      } else {
        counts.set(slug, {
          kind: "tag",
          value: slug,
          label: signal.label || humanizeSlug(slug),
          count: 1,
          source: signal.source,
        });
      }
    }
  }

  const minCount = options?.minCount ?? (items.length >= 15 ? 3 : 2);
  const limit = options?.limit ?? 6;

  return Array.from(counts.values())
    .filter((filter) => filter.count >= minCount)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.source !== b.source) return a.source === "category" ? -1 : 1;
      return a.label.localeCompare(b.label);
    })
    .slice(0, limit);
}
