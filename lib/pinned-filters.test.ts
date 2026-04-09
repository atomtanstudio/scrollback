import { describe, expect, it } from "vitest";
import {
  addPinnedFilter,
  parsePinnedFilters,
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
});
