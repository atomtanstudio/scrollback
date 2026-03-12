import type { SearchProvider } from "@/lib/db/search-provider";
import type { SearchFilters, SearchOptions, ScoredResult } from "@/lib/db/types";

/**
 * SQLite search provider stub.
 *
 * SQLite does not natively support pgvector or tsvector, so all search
 * methods return empty results. This stub exists so the application can
 * start with SQLite during development and swap to PostgreSQL for
 * production search.
 *
 * TODO: Implement FTS5 keyword search and a local vector similarity
 * approach (e.g. sqlite-vss or in-memory cosine) when SQLite support
 * is needed.
 */
export class SqliteSearchProvider implements SearchProvider {
  async keywordSearch(
    _query: string,
    _filters: SearchFilters,
    _opts: SearchOptions
  ): Promise<ScoredResult[]> {
    console.warn("SQLite keyword search not yet implemented");
    return [];
  }

  async semanticSearch(
    _embedding: number[],
    _filters: SearchFilters,
    _opts: SearchOptions
  ): Promise<ScoredResult[]> {
    console.warn("SQLite semantic search not yet implemented");
    return [];
  }

  async authorSearch(
    _query: string,
    _filters: SearchFilters,
    _opts: SearchOptions
  ): Promise<ScoredResult[]> {
    console.warn("SQLite author search not yet implemented");
    return [];
  }

  async countResults(
    _query: string,
    _filters: SearchFilters
  ): Promise<number> {
    console.warn("SQLite countResults not yet implemented");
    return 0;
  }

  async writeEmbedding(
    _itemId: string,
    _embedding: number[]
  ): Promise<void> {
    // No-op: SQLite does not support vector columns
  }

  async updateSearchVector(
    _itemId: string,
    _content: {
      title: string;
      body: string;
      summary?: string;
      author?: string;
    }
  ): Promise<void> {
    // No-op: SQLite does not support tsvector
  }
}
