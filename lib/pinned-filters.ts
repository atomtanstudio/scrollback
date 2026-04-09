export type PinnedFilterKind = "type" | "tag";

export interface PinnedFilter {
  kind: PinnedFilterKind;
  value: string;
  label: string;
}

const DEFAULT_PINNED_FILTERS: PinnedFilter[] = [
  { kind: "type", value: "art", label: "Art" },
];

const VALID_TYPE_FILTERS = new Set(["art", "tweet", "thread", "article", "rss"]);

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
