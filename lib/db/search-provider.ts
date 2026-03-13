import type { SearchFilters, SearchOptions, ScoredResult } from "./types";
import { getConfig } from "@/lib/config";

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
let _cachedDbType: string | null = null;

export async function getSearchProvider(): Promise<SearchProvider> {
  const config = getConfig();
  const dbType = config?.database.type || process.env.DATABASE_TYPE || "postgresql";

  // Invalidate cache if database type changed
  if (_cachedProvider && _cachedDbType === dbType) return _cachedProvider;

  switch (dbType) {
    case "postgresql": {
      const { PostgresSearchProvider } = await import("./providers/postgresql");
      _cachedProvider = new PostgresSearchProvider();
      break;
    }
    case "supabase": {
      const { SupabaseSearchProvider } = await import("./providers/supabase");
      _cachedProvider = new SupabaseSearchProvider();
      break;
    }
    case "sqlite": {
      const { SqliteSearchProvider } = await import("./providers/sqlite");
      _cachedProvider = new SqliteSearchProvider();
      break;
    }
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }

  _cachedDbType = dbType;
  return _cachedProvider;
}

/**
 * Invalidate the cached provider. Call when switching databases.
 */
export function invalidateSearchProvider(): void {
  _cachedProvider = null;
  _cachedDbType = null;
}
