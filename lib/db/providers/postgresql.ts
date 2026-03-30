import { getClient } from "@/lib/db/client";
import type { SearchProvider } from "@/lib/db/search-provider";
import type { SearchFilters, SearchOptions, ScoredResult } from "@/lib/db/types";

/**
 * Raw row shape returned from search queries.
 * Matches the SELECT columns in our SQL.
 */
interface RawSearchRow {
  id: string;
  source_type: string;
  title: string;
  body_excerpt: string;
  author_handle: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  original_url: string | null;
  posted_at: Date | string | null;
  media_id: string | null;
  media_type: string | null;
  media_url: string | null;
  relevance_score: number;
}

/**
 * Build dynamic WHERE clause fragments and parameter values for shared filters.
 * Returns { clauses: string[], params: unknown[], nextIndex: number }
 *
 * `startIndex` is the 1-based $N placeholder index to begin with.
 */
function buildFilterClauses(
  filters: SearchFilters,
  startIndex: number
): { clauses: string[]; params: unknown[]; nextIndex: number } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = startIndex;

  if (filters.type) {
    clauses.push(`ci.source_type = $${idx}::source_type_enum`);
    params.push(filters.type);
    idx++;
  }

  if (filters.author) {
    clauses.push(
      `(ci.author_handle ILIKE $${idx} OR ci.author_display_name ILIKE $${idx})`
    );
    params.push(`%${filters.author}%`);
    idx++;
  }

  if (filters.dateFrom) {
    clauses.push(`ci.posted_at >= $${idx}::timestamptz`);
    params.push(filters.dateFrom);
    idx++;
  }

  if (filters.dateTo) {
    clauses.push(`ci.posted_at <= $${idx}::timestamptz`);
    params.push(filters.dateTo);
    idx++;
  }

  if (filters.userId) {
    clauses.push(`ci.user_id = $${idx}::uuid`);
    params.push(filters.userId);
    idx++;
  }

  return { clauses, params, nextIndex: idx };
}

/**
 * Map a raw database row to a ScoredResult.
 */
function mapRow(row: RawSearchRow): ScoredResult {
  return {
    id: row.id,
    source_type: row.source_type,
    title: row.title,
    body_excerpt: row.body_excerpt,
    author_handle: row.author_handle,
    author_display_name: row.author_display_name,
    author_avatar_url: row.author_avatar_url,
    source_url: row.original_url,
    posted_at: row.posted_at
      ? row.posted_at instanceof Date
        ? row.posted_at.toISOString()
        : String(row.posted_at)
      : null,
    media_preview:
      row.media_id && row.media_type && row.media_url
        ? { id: row.media_id, type: row.media_type, url: row.media_url }
        : null,
    relevance_score:
      typeof row.relevance_score === "number"
        ? row.relevance_score
        : Number(row.relevance_score) || 0,
  };
}

/**
 * Shared media lateral join fragment.
 */
const MEDIA_LATERAL_JOIN = `
  LEFT JOIN LATERAL (
    SELECT id AS media_id, media_type, original_url AS media_url
    FROM media
    WHERE content_item_id = ci.id
    ORDER BY position_in_content ASC NULLS LAST
    LIMIT 1
  ) m ON true
`;

export class PostgresSearchProvider implements SearchProvider {
  /**
   * Full-text keyword search using tsvector + ts_rank_cd.
   * Falls back to ILIKE if query is empty or ts_rank returns 0 rows.
   */
  async keywordSearch(
    query: string,
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]> {
    const prisma = await getClient();
    const offset = (opts.page - 1) * opts.perPage;

    // Build filter clauses starting at $2 (query is $1)
    const { clauses, params: filterParams, nextIndex } = buildFilterClauses(
      filters,
      2
    );

    // tsvector-based search
    const tsWhere = [
      `ci.search_vector @@ websearch_to_tsquery('english', $1)`,
      ...clauses,
    ].join(" AND ");

    const limitParam = `$${nextIndex}`;
    const offsetParam = `$${nextIndex + 1}`;

    const sql = `
      SELECT
        ci.id,
        ci.source_type::text,
        ci.title,
        ts_headline('english', LEFT(ci.body_text, 500),
          websearch_to_tsquery('english', $1),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
        ) AS body_excerpt,
        ci.author_handle,
        ci.author_display_name,
        ci.author_avatar_url,
        ci.original_url,
        ci.posted_at,
        m.media_id,
        m.media_type::text,
        m.media_url,
        ts_rank_cd(ci.search_vector, websearch_to_tsquery('english', $1)) AS relevance_score
      FROM content_items ci
      ${MEDIA_LATERAL_JOIN}
      WHERE ${tsWhere}
      ORDER BY relevance_score DESC, ci.posted_at DESC NULLS LAST
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const allParams = [query, ...filterParams, opts.perPage, offset];

    try {
      const rows = (await prisma.$queryRawUnsafe(
        sql,
        ...allParams
      )) as RawSearchRow[];
      return rows.map(mapRow);
    } catch (err) {
      console.error("[PostgresSearchProvider] keywordSearch error:", err);
      // Fallback to ILIKE search
      return this.ilikeFallback(query, filters, opts);
    }
  }

  /**
   * ILIKE fallback when tsvector search is unavailable or fails.
   */
  private async ilikeFallback(
    query: string,
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]> {
    const prisma = await getClient();
    const offset = (opts.page - 1) * opts.perPage;
    const likePattern = `%${query}%`;

    // $1 = likePattern for the ILIKE clauses
    const { clauses, params: filterParams, nextIndex } = buildFilterClauses(
      filters,
      2
    );

    const where = [
      `(ci.title ILIKE $1 OR ci.body_text ILIKE $1)`,
      ...clauses,
    ].join(" AND ");

    const limitParam = `$${nextIndex}`;
    const offsetParam = `$${nextIndex + 1}`;

    const sql = `
      SELECT
        ci.id,
        ci.source_type::text,
        ci.title,
        LEFT(ci.body_text, 200) AS body_excerpt,
        ci.author_handle,
        ci.author_display_name,
        ci.author_avatar_url,
        ci.original_url,
        ci.posted_at,
        m.media_id,
        m.media_type::text,
        m.media_url,
        1.0 AS relevance_score
      FROM content_items ci
      ${MEDIA_LATERAL_JOIN}
      WHERE ${where}
      ORDER BY ci.posted_at DESC NULLS LAST
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const allParams = [likePattern, ...filterParams, opts.perPage, offset];

    const rows = (await prisma.$queryRawUnsafe(
      sql,
      ...allParams
    )) as RawSearchRow[];
    return rows.map(mapRow);
  }

  /**
   * Semantic (vector) search using pgvector cosine distance.
   */
  async semanticSearch(
    embedding: number[],
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]> {
    const prisma = await getClient();
    const offset = (opts.page - 1) * opts.perPage;

    // $1 = vector string, e.g. "[0.1,0.2,...]"
    const vectorStr = `[${embedding.join(",")}]`;

    const { clauses, params: filterParams, nextIndex } = buildFilterClauses(
      filters,
      2
    );

    const where = [`ci.embedding IS NOT NULL`, ...clauses].join(" AND ");

    const limitParam = `$${nextIndex}`;
    const offsetParam = `$${nextIndex + 1}`;

    const sql = `
      SELECT
        ci.id,
        ci.source_type::text,
        ci.title,
        LEFT(ci.body_text, 200) AS body_excerpt,
        ci.author_handle,
        ci.author_display_name,
        ci.author_avatar_url,
        ci.original_url,
        ci.posted_at,
        m.media_id,
        m.media_type::text,
        m.media_url,
        (1 - (ci.embedding <=> $1::vector)) AS relevance_score
      FROM content_items ci
      ${MEDIA_LATERAL_JOIN}
      WHERE ${where}
      ORDER BY ci.embedding <=> $1::vector ASC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const allParams = [vectorStr, ...filterParams, opts.perPage, offset];

    try {
      const rows = (await prisma.$queryRawUnsafe(
        sql,
        ...allParams
      )) as RawSearchRow[];
      return rows.map(mapRow);
    } catch (err) {
      console.error("[PostgresSearchProvider] semanticSearch error:", err);
      return [];
    }
  }

  /**
   * Author search using ILIKE on author_handle and author_display_name.
   */
  async authorSearch(
    query: string,
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]> {
    const prisma = await getClient();
    const offset = (opts.page - 1) * opts.perPage;
    const likePattern = `%${query}%`;

    // $1 = likePattern for author search
    const { clauses, params: filterParams, nextIndex } = buildFilterClauses(
      filters,
      2
    );

    const where = [
      `(ci.author_handle ILIKE $1 OR ci.author_display_name ILIKE $1)`,
      ...clauses,
    ].join(" AND ");

    const limitParam = `$${nextIndex}`;
    const offsetParam = `$${nextIndex + 1}`;

    const sql = `
      SELECT
        ci.id,
        ci.source_type::text,
        ci.title,
        LEFT(ci.body_text, 200) AS body_excerpt,
        ci.author_handle,
        ci.author_display_name,
        ci.author_avatar_url,
        ci.original_url,
        ci.posted_at,
        m.media_id,
        m.media_type::text,
        m.media_url,
        1.0 AS relevance_score
      FROM content_items ci
      ${MEDIA_LATERAL_JOIN}
      WHERE ${where}
      ORDER BY ci.posted_at DESC NULLS LAST
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const allParams = [likePattern, ...filterParams, opts.perPage, offset];

    try {
      const rows = (await prisma.$queryRawUnsafe(
        sql,
        ...allParams
      )) as RawSearchRow[];
      return rows.map(mapRow);
    } catch (err) {
      console.error("[PostgresSearchProvider] authorSearch error:", err);
      return [];
    }
  }

  /**
   * Count total matching results for keyword search (for pagination).
   */
  async countResults(query: string, filters: SearchFilters): Promise<number> {
    const prisma = await getClient();
    const { clauses, params: filterParams } = buildFilterClauses(filters, 2);

    const tsWhere = [
      `ci.search_vector @@ websearch_to_tsquery('english', $1)`,
      ...clauses,
    ].join(" AND ");

    const sql = `
      SELECT COUNT(*)::int AS total
      FROM content_items ci
      WHERE ${tsWhere}
    `;

    const allParams = [query, ...filterParams];

    try {
      const rows = (await prisma.$queryRawUnsafe(sql, ...allParams)) as Array<{
        total: number;
      }>;
      return rows[0]?.total ?? 0;
    } catch (err) {
      console.error("[PostgresSearchProvider] countResults tsvector error:", err);

      // Fallback to ILIKE count
      const likePattern = `%${query}%`;
      const { clauses: fallbackClauses, params: fallbackParams } =
        buildFilterClauses(filters, 2);

      const fallbackWhere = [
        `(ci.title ILIKE $1 OR ci.body_text ILIKE $1)`,
        ...fallbackClauses,
      ].join(" AND ");

      const fallbackSql = `
        SELECT COUNT(*)::int AS total
        FROM content_items ci
        WHERE ${fallbackWhere}
      `;

      const rows = (await prisma.$queryRawUnsafe(
        fallbackSql,
        likePattern,
        ...fallbackParams
      )) as Array<{ total: number }>;
      return rows[0]?.total ?? 0;
    }
  }

  /**
   * Write a vector embedding to the embedding column for a content item.
   */
  async writeEmbedding(itemId: string, embedding: number[]): Promise<void> {
    const prisma = await getClient();
    const vectorStr = `[${embedding.join(",")}]`;

    await prisma.$queryRawUnsafe(
      `UPDATE content_items SET embedding = $1::vector, updated_at = NOW() WHERE id = $2::uuid`,
      vectorStr,
      itemId
    );
  }

  /**
   * Build and write a weighted tsvector for a content item.
   * Weights: A=title, B=body, C=summary, D=author
   */
  async updateSearchVector(
    itemId: string,
    content: {
      title: string;
      body: string;
      summary?: string;
      author?: string;
    }
  ): Promise<void> {
    const prisma = await getClient();
    const parts: string[] = [
      `setweight(to_tsvector('english', COALESCE($1, '')), 'A')`,
      `setweight(to_tsvector('english', COALESCE($2, '')), 'B')`,
    ];

    const params: unknown[] = [content.title, content.body];
    let paramIdx = 3;

    if (content.summary !== undefined) {
      parts.push(
        `setweight(to_tsvector('english', COALESCE($${paramIdx}, '')), 'C')`
      );
      params.push(content.summary);
      paramIdx++;
    }

    if (content.author !== undefined) {
      parts.push(
        `setweight(to_tsvector('english', COALESCE($${paramIdx}, '')), 'D')`
      );
      params.push(content.author);
      paramIdx++;
    }

    const vectorExpr = parts.join(" || ");

    await prisma.$queryRawUnsafe(
      `UPDATE content_items SET search_vector = ${vectorExpr}, updated_at = NOW() WHERE id = $${paramIdx}::uuid`,
      ...params,
      itemId
    );
  }
}
