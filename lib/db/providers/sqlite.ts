/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import type { SearchProvider } from "@/lib/db/search-provider";
import type { SearchFilters, SearchOptions, ScoredResult } from "@/lib/db/types";
import { getClient } from "@/lib/db/client";

/**
 * SQLite search provider using FTS5 for keyword search.
 * Semantic search (vector similarity) is not supported on SQLite.
 */
export class SqliteSearchProvider implements SearchProvider {
  /**
   * Ensure the FTS5 virtual table exists.
   * Safe to call multiple times — uses IF NOT EXISTS.
   */
  async ensureFts5Table(): Promise<void> {
    const prisma = await getClient();
    await prisma.$executeRawUnsafe(`
      CREATE VIRTUAL TABLE IF NOT EXISTS content_items_fts USING fts5(
        title,
        body_text,
        ai_summary,
        author_handle,
        content=content_items,
        content_rowid=rowid
      )
    `);
    // Triggers to keep FTS5 in sync with content_items on delete/update
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER IF NOT EXISTS content_items_fts_delete
      AFTER DELETE ON content_items BEGIN
        INSERT INTO content_items_fts(content_items_fts, rowid, title, body_text, ai_summary, author_handle)
        VALUES('delete', old.rowid, old.title, old.body_text, old.ai_summary, old.author_handle);
      END
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER IF NOT EXISTS content_items_fts_update
      AFTER UPDATE ON content_items BEGIN
        INSERT INTO content_items_fts(content_items_fts, rowid, title, body_text, ai_summary, author_handle)
        VALUES('delete', old.rowid, old.title, old.body_text, old.ai_summary, old.author_handle);
        INSERT INTO content_items_fts(rowid, title, body_text, ai_summary, author_handle)
        VALUES(new.rowid, new.title, new.body_text, new.ai_summary, new.author_handle);
      END
    `);
  }

  async keywordSearch(
    query: string,
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]> {
    if (!query.trim()) return [];

    const prisma = await getClient();
    const offset = (opts.page - 1) * opts.perPage;

    // Build filter clauses
    let filterSql = "";
    const params: unknown[] = [];

    if (filters.type) {
      filterSql += ` AND ci.source_type = ?`;
      params.push(filters.type);
    }
    if (filters.author) {
      filterSql += ` AND (ci.author_handle LIKE ? OR ci.author_display_name LIKE ?)`;
      params.push(`%${filters.author}%`, `%${filters.author}%`);
    }

    // FTS5 query with bm25 ranking
    const ftsQuery = query.replace(/['"]/g, ""); // sanitize for FTS5
    const results = await prisma.$queryRawUnsafe(`
      SELECT ci.id, ci.source_type, ci.title,
             substr(ci.body_text, 1, 200) as body_excerpt,
             ci.author_handle, ci.author_display_name, ci.author_avatar_url,
             ci.original_url, ci.posted_at,
             m.id as media_id, m.media_type, m.original_url as media_url,
             bm25(content_items_fts) as relevance_score
      FROM content_items_fts
      JOIN content_items ci ON content_items_fts.rowid = ci.rowid
      LEFT JOIN media m ON m.content_item_id = ci.id
      WHERE content_items_fts MATCH ?
        ${filterSql}
      ORDER BY bm25(content_items_fts)
      LIMIT ? OFFSET ?
    `, ftsQuery, ...params, opts.perPage, offset) as any[];

    return results.map(this.mapRow);
  }

  async semanticSearch(
    _embedding: number[],
    _filters: SearchFilters,
    _opts: SearchOptions
  ): Promise<ScoredResult[]> {
    // Vector search not supported on SQLite
    return [];
  }

  async authorSearch(
    query: string,
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]> {
    const prisma = await getClient();
    const offset = (opts.page - 1) * opts.perPage;
    const searchTerm = query.startsWith("@") ? query.slice(1) : query;

    const results = await prisma.$queryRawUnsafe(`
      SELECT ci.id, ci.source_type, ci.title,
             substr(ci.body_text, 1, 200) as body_excerpt,
             ci.author_handle, ci.author_display_name, ci.author_avatar_url,
             ci.original_url, ci.posted_at,
             m.id as media_id, m.media_type, m.original_url as media_url,
             1.0 as relevance_score
      FROM content_items ci
      LEFT JOIN media m ON m.content_item_id = ci.id
      WHERE ci.author_handle LIKE ? OR ci.author_display_name LIKE ?
      ORDER BY ci.posted_at DESC
      LIMIT ? OFFSET ?
    `, `%${searchTerm}%`, `%${searchTerm}%`, opts.perPage, offset) as any[];

    return results.map(this.mapRow);
  }

  async countResults(query: string, filters: SearchFilters): Promise<number> {
    if (!query.trim()) return 0;
    const prisma = await getClient();
    const ftsQuery = query.replace(/['"]/g, "");

    let filterSql = "";
    const params: unknown[] = [];
    if (filters.type) {
      filterSql += ` AND ci.source_type = ?`;
      params.push(filters.type);
    }

    const result = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count
      FROM content_items_fts
      JOIN content_items ci ON content_items_fts.rowid = ci.rowid
      WHERE content_items_fts MATCH ?
        ${filterSql}
    `, ftsQuery, ...params) as any[];

    return Number(result[0]?.count ?? 0);
  }

  async writeEmbedding(
    _itemId: string,
    _embedding: number[]
  ): Promise<void> {
    // No-op: SQLite does not support vector columns
  }

  async updateSearchVector(
    itemId: string,
    content: { title: string; body: string; summary?: string; author?: string }
  ): Promise<void> {
    const prisma = await getClient();

    // Get the rowid for this content item
    const rows = await prisma.$queryRawUnsafe(
      `SELECT rowid FROM content_items WHERE id = ?`,
      itemId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any[];

    if (rows.length === 0) return;
    const rowid = rows[0].rowid;

    // Upsert into FTS5 table using INSERT OR REPLACE pattern
    // First delete existing entry, then insert
    await prisma.$executeRawUnsafe(
      `DELETE FROM content_items_fts WHERE rowid = ?`,
      rowid
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO content_items_fts(rowid, title, body_text, ai_summary, author_handle)
       VALUES (?, ?, ?, ?, ?)`,
      rowid,
      content.title || "",
      content.body || "",
      content.summary || "",
      content.author || ""
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapRow(row: any): ScoredResult {
    return {
      id: row.id,
      source_type: row.source_type,
      title: row.title || "",
      body_excerpt: row.body_excerpt || "",
      author_handle: row.author_handle,
      author_display_name: row.author_display_name,
      author_avatar_url: row.author_avatar_url,
      source_url: row.original_url,
      posted_at: row.posted_at ? String(row.posted_at) : null,
      media_preview:
        row.media_id && row.media_type && row.media_url
          ? { id: row.media_id, type: row.media_type, url: row.media_url }
          : null,
      relevance_score: Math.abs(Number(row.relevance_score) || 0),
    };
  }
}
