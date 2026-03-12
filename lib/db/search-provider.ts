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

export function getSearchProvider(): SearchProvider {
  const dbType = process.env.DATABASE_TYPE || "postgresql";
  switch (dbType) {
    case "postgresql": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PostgresSearchProvider } = require("./providers/postgresql");
      return new PostgresSearchProvider();
    }
    case "supabase": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SupabaseSearchProvider } = require("./providers/supabase");
      return new SupabaseSearchProvider();
    }
    case "sqlite": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SqliteSearchProvider } = require("./providers/sqlite");
      return new SqliteSearchProvider();
    }
    default:
      throw new Error(`Unsupported DATABASE_TYPE: ${dbType}`);
  }
}
