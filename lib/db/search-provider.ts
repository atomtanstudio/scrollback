import type { SearchFilters, SearchOptions, ScoredResult } from "./types";

export interface SearchProvider {
  keywordSearch(
    query: string,
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]>;

  semanticSearch(
    embedding: number[],
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]>;

  authorSearch(
    query: string,
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]>;

  countResults(query: string, filters: SearchFilters): Promise<number>;

  writeEmbedding(itemId: string, embedding: number[]): Promise<void>;

  updateSearchVector(
    itemId: string,
    content: {
      title: string;
      body: string;
      summary?: string;
      author?: string;
    }
  ): Promise<void>;
}

let _cachedProvider: SearchProvider | null = null;

export async function getSearchProvider(): Promise<SearchProvider> {
  if (_cachedProvider) return _cachedProvider;

  const dbType = process.env.DATABASE_TYPE || "postgresql";
  switch (dbType) {
    case "postgresql": {
      const { PostgresSearchProvider } = await import("./providers/postgresql");
      _cachedProvider = new PostgresSearchProvider();
      return _cachedProvider;
    }
    case "supabase": {
      const { SupabaseSearchProvider } = await import("./providers/supabase");
      _cachedProvider = new SupabaseSearchProvider();
      return _cachedProvider;
    }
    case "sqlite": {
      const { SqliteSearchProvider } = await import("./providers/sqlite");
      _cachedProvider = new SqliteSearchProvider();
      return _cachedProvider;
    }
    default:
      throw new Error(`Unsupported DATABASE_TYPE: ${dbType}`);
  }
}
