import { describe, it, expect } from "vitest";
import { mergeAndRankResults } from "./hybrid";
import type { ScoredResult } from "../db/types";

const makeResult = (id: string, score: number): ScoredResult => ({
  id,
  source_type: "tweet",
  title: `Result ${id}`,
  body_excerpt: "text",
  author_handle: "user",
  author_display_name: "User",
  author_avatar_url: null,
  source_url: null,
  posted_at: null,
  media_preview: null,
  relevance_score: score,
});

describe("mergeAndRankResults", () => {
  it("merges keyword and semantic results with weighted scores", () => {
    const keyword = [makeResult("a", 0.8), makeResult("b", 0.6)];
    const semantic = [makeResult("a", 0.9), makeResult("c", 0.7)];
    const merged = mergeAndRankResults(keyword, semantic, [], 0.4, 0.6);

    // "a": 0.4*0.8 + 0.6*0.9 = 0.86
    expect(merged.find((r) => r.id === "a")?.relevance_score).toBeCloseTo(
      0.86
    );
    // "b": 0.4*0.6 = 0.24
    expect(merged.find((r) => r.id === "b")?.relevance_score).toBeCloseTo(
      0.24
    );
    // "c": 0.6*0.7 = 0.42
    expect(merged.find((r) => r.id === "c")?.relevance_score).toBeCloseTo(
      0.42
    );
    // Sorted descending
    expect(merged[0].id).toBe("a");
  });

  it("includes author results with a bonus", () => {
    const keyword = [makeResult("a", 0.5)];
    const author = [makeResult("a", 1.0), makeResult("d", 1.0)];
    const merged = mergeAndRankResults(keyword, [], author, 0.4, 0.6);
    const resultA = merged.find((r) => r.id === "a");
    expect(resultA!.relevance_score).toBeGreaterThan(0.2); // keyword + boost
    expect(merged.find((r) => r.id === "d")).toBeDefined();
  });

  it("handles empty inputs", () => {
    expect(mergeAndRankResults([], [], [], 0.4, 0.6)).toEqual([]);
  });

  it("deduplicates by ID", () => {
    const keyword = [makeResult("a", 1.0)];
    const semantic = [makeResult("a", 0.1)];
    const merged = mergeAndRankResults(keyword, semantic, [], 0.4, 0.6);
    expect(merged).toHaveLength(1);
  });

  it("sorts results by relevance_score in descending order", () => {
    const keyword = [makeResult("a", 0.3), makeResult("b", 0.9)];
    const semantic = [makeResult("c", 0.5)];
    const merged = mergeAndRankResults(keyword, semantic, [], 0.5, 0.5);
    // b: 0.5*0.9 = 0.45, c: 0.5*0.5 = 0.25, a: 0.5*0.3 = 0.15
    expect(merged[0].id).toBe("b");
    expect(merged[1].id).toBe("c");
    expect(merged[2].id).toBe("a");
  });

  it("preserves metadata from first-seen result", () => {
    const keyword = [makeResult("a", 0.8)];
    keyword[0].title = "Keyword Title";
    const semantic = [makeResult("a", 0.9)];
    semantic[0].title = "Semantic Title";
    const merged = mergeAndRankResults(keyword, semantic, [], 0.4, 0.6);
    // First encounter (keyword) title should be preserved
    expect(merged[0].title).toBe("Keyword Title");
  });

  it("author-only results get the author boost score", () => {
    const author = [makeResult("x", 1.0)];
    const merged = mergeAndRankResults([], [], author, 0.4, 0.6);
    // x: 0 keyword + 0 semantic + 0.15 author boost = 0.15
    expect(merged).toHaveLength(1);
    expect(merged[0].relevance_score).toBeCloseTo(0.15);
  });
});
