import { describe, expect, it } from "vitest";
import {
  addPinnedFilter,
  parsePinnedFilters,
  rankSuggestedPinnedFilters,
  removePinnedFilter,
  serializePinnedFilters,
} from "@/lib/pinned-filters";

describe("pinned filters", () => {
  it("defaults to the Art pin when unset", () => {
    expect(parsePinnedFilters(null)).toEqual([
      { kind: "type", value: "art", label: "Art" },
    ]);
  });

  it("preserves an explicit empty pin list", () => {
    expect(parsePinnedFilters("[]")).toEqual([]);
  });

  it("deduplicates and serializes valid pins", () => {
    const filters = parsePinnedFilters(
      JSON.stringify([
        { kind: "tag", value: "adhd", label: "ADHD" },
        { kind: "tag", value: "adhd", label: "ADHD" },
      ])
    );

    expect(filters).toEqual([{ kind: "tag", value: "adhd", label: "ADHD" }]);
    expect(serializePinnedFilters(filters)).toBe(
      JSON.stringify([{ kind: "tag", value: "adhd", label: "ADHD" }])
    );
  });

  it("adds and removes filters by kind and value", () => {
    const withTag = addPinnedFilter(
      [{ kind: "type", value: "art", label: "Art" }],
      { kind: "tag", value: "adhd", label: "ADHD" }
    );
    expect(withTag).toEqual([
      { kind: "type", value: "art", label: "Art" },
      { kind: "tag", value: "adhd", label: "ADHD" },
    ]);

    expect(removePinnedFilter(withTag, { kind: "type", value: "art", label: "Art" })).toEqual([
      { kind: "tag", value: "adhd", label: "ADHD" },
    ]);
  });

  it("surfaces recurring user interests as suggested pins", () => {
    const suggestions = rankSuggestedPinnedFilters(
      [
        [
          { slug: "cancer-research", label: "Cancer Research", source: "category" },
          { slug: "medical-ai", label: "Medical AI", source: "tag" },
        ],
        [
          { slug: "cancer-research", label: "Cancer Research", source: "category" },
          { slug: "oncology", label: "Oncology", source: "tag" },
        ],
        [
          { slug: "cancer-research", label: "Cancer Research", source: "tag" },
          { slug: "oncology", label: "Oncology", source: "tag" },
        ],
      ],
      [{ kind: "type", value: "art", label: "Art" }],
      { minCount: 2, limit: 5 }
    );

    expect(suggestions).toEqual([
      { kind: "tag", value: "cancer-research", label: "Cancer Research", count: 3, source: "category" },
      { kind: "tag", value: "oncology", label: "Oncology", count: 2, source: "tag" },
    ]);
  });

  it("filters out already pinned and noisy topic suggestions", () => {
    const suggestions = rankSuggestedPinnedFilters(
      [
        [
          { slug: "art", label: "Art", source: "tag" },
          { slug: "adhd", label: "ADHD", source: "tag" },
        ],
        [
          { slug: "adhd", label: "ADHD", source: "tag" },
          { slug: "tweet", label: "Tweet", source: "tag" },
        ],
      ],
      [{ kind: "tag", value: "adhd", label: "ADHD" }],
      { minCount: 1, limit: 5 }
    );

    expect(suggestions).toEqual([]);
  });
});
