import type { ScoredResult } from "../db/types";

const AUTHOR_BOOST = 0.15;

/**
 * Merges keyword, semantic, and author search results with configurable weights.
 * Deduplicates by ID, computes weighted scores, and returns sorted results.
 */
export function mergeAndRankResults(
  keywordResults: ScoredResult[],
  semanticResults: ScoredResult[],
  authorResults: ScoredResult[],
  keywordWeight: number,
  semanticWeight: number
): ScoredResult[] {
  const merged = new Map<
    string,
    {
      result: ScoredResult;
      kwScore: number;
      semScore: number;
      isAuthorMatch: boolean;
    }
  >();

  for (const r of keywordResults) {
    merged.set(r.id, {
      result: r,
      kwScore: r.relevance_score,
      semScore: 0,
      isAuthorMatch: false,
    });
  }

  for (const r of semanticResults) {
    const existing = merged.get(r.id);
    if (existing) {
      existing.semScore = r.relevance_score;
    } else {
      merged.set(r.id, {
        result: r,
        kwScore: 0,
        semScore: r.relevance_score,
        isAuthorMatch: false,
      });
    }
  }

  for (const r of authorResults) {
    const existing = merged.get(r.id);
    if (existing) {
      existing.isAuthorMatch = true;
    } else {
      merged.set(r.id, {
        result: r,
        kwScore: 0,
        semScore: 0,
        isAuthorMatch: true,
      });
    }
  }

  const results: ScoredResult[] = [];
  for (const { result, kwScore, semScore, isAuthorMatch } of merged.values()) {
    const baseScore = keywordWeight * kwScore + semanticWeight * semScore;
    const boost = isAuthorMatch ? AUTHOR_BOOST : 0;
    results.push({ ...result, relevance_score: baseScore + boost });
  }

  results.sort((a, b) => b.relevance_score - a.relevance_score);
  return results;
}
