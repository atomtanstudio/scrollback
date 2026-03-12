import { PostgresSearchProvider } from "./postgresql";

/**
 * Supabase search provider.
 *
 * Supabase runs PostgreSQL under the hood, so the PostgresSearchProvider
 * implementation works as-is. This class exists as an extension point
 * for any future Supabase-specific optimizations (e.g. using Supabase
 * Edge Functions, Supabase Vector, or the PostgREST API instead of
 * direct SQL).
 */
export class SupabaseSearchProvider extends PostgresSearchProvider {}
