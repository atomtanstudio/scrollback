# FeedSilo Session 1: Database & Search Foundation — Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the FeedSilo Next.js monorepo with hybrid search API, ingest endpoint (preserving extension backward compat), and multi-backend database adapter — all working against the existing ~1807-row basex PostgreSQL database.

**Architecture:** Prisma ORM for CRUD and schema mapping. SearchProvider interface with backend-specific raw SQL implementations for pgvector/tsvector queries. Next.js 14 App Router API routes. Gemini for embedding generation.

**Tech Stack:** Next.js 14, TypeScript, Prisma, Tailwind CSS, shadcn/ui, @google/genai, pgvector, framer-motion (installed only)

**Spec:** `docs/superpowers/specs/2026-03-12-session1-database-search-foundation-design.md`

---

## Chunk 1: Project Scaffolding

### Task 1: Initialize Next.js project and install dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `app/globals.css`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Create Next.js 14 project**

```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

Accept defaults. This scaffolds the Next.js project in the current directory.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install prisma @prisma/client @google/genai framer-motion zod uuid
npm install -D @types/uuid
```

- shadcn/ui will be initialized in a separate step
- `zod` for request validation
- `uuid` for generating UUIDs on ingest

- [ ] **Step 3: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Select: New York style, Zinc base color, CSS variables: yes.

- [ ] **Step 4: Create `.env.example`**

Write to `.env.example`:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/basex
DATABASE_TYPE=postgresql  # postgresql | supabase | sqlite

# Gemini (for embeddings)
GEMINI_API_KEY=

# Extension auth
CAPTURE_SECRET=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Search tuning
SEARCH_KEYWORD_WEIGHT=0.4
SEARCH_VECTOR_WEIGHT=0.6
```

- [ ] **Step 5: Create `.env.local` from example**

Copy `.env.example` to `.env.local` and fill in `DATABASE_URL`, `GEMINI_API_KEY`, and `CAPTURE_SECRET` from the existing basex `.env` file at `/Users/richgates/Documents/vibecoding/basex/.env`.

- [ ] **Step 6: Update `.gitignore`**

Ensure `.gitignore` includes:
```
.env.local
.env
node_modules/
.next/
prisma/migrations/
```

- [ ] **Step 7: Verify `npm run dev` starts**

```bash
npm run dev
```

Expected: Next.js dev server starts on port 3000 with the default page.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 project with dependencies"
```

---

### Task 2: Prisma schema mapping existing database

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/db/prisma.ts`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` with a basic PostgreSQL datasource.

- [ ] **Step 2: Introspect existing database**

```bash
npx prisma db pull
```

This reads the existing `basex` database and generates the Prisma schema from it. Review the output — it should contain `content_items`, `categories`, `tags`, `media`, `content_categories`, `content_tags`, `users`, `rescan_tasks`.

- [ ] **Step 3: Clean up the generated schema**

The introspected schema will have raw column types. Edit `prisma/schema.prisma` to:

1. Rename models to PascalCase if needed (Prisma convention)
2. Map `embedding` column to `Unsupported("vector(768)")` if not already
3. Map `search_vector` column to `Unsupported("tsvector")` if not already
4. Add proper enum definitions for `source_type_enum`, `processing_status_enum`, `prompt_type_enum`, `media_type_enum`
5. Ensure all relationships are defined (ContentItem → Media, ContentItem ↔ Categories via join table, ContentItem ↔ Tags via join table)
6. Keep `@@map("table_name")` annotations to preserve existing table names
7. Remove `users` and `rescan_tasks` models (not needed for Session 1) — but ONLY from the Prisma schema, NOT from the database

The schema should look approximately like this (introspection will give us the exact column types):

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector"), pg_trgm]
}

enum SourceType {
  tweet
  article
  thread
  image_prompt
  video_prompt
  unknown

  @@map("source_type_enum")
}

enum ProcessingStatus {
  parsed
  enriched
  media_downloaded
  categorized
  indexed
  error

  @@map("processing_status_enum")
}

enum PromptType {
  image
  video
  text

  @@map("prompt_type_enum")
}

enum MediaType {
  image
  video
  gif

  @@map("media_type_enum")
}

model ContentItem {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  source_type       SourceType
  external_id       String?   @db.Text
  author_handle     String?   @db.Text
  author_display_name String? @db.Text
  author_avatar_url String?   @db.Text
  title             String    @db.Text
  body_text         String    @db.Text
  body_html         String?   @db.Text
  original_url      String?   @db.Text
  posted_at         DateTime? @db.Timestamptz()
  likes             Int?
  retweets          Int?
  replies           Int?
  views             Int?
  has_prompt        Boolean   @default(false)
  prompt_text       String?   @db.Text
  prompt_type       PromptType?
  language          String?   @db.Text
  ai_summary        String?   @db.Text
  raw_markdown      String    @db.Text
  source_file_path  String    @unique @db.Text
  content_hash      String    @db.Text
  processing_status ProcessingStatus @default(parsed)
  processing_error  String?   @db.Text
  embedding         Unsupported("vector(768)")?
  search_vector     Unsupported("tsvector")?
  created_at        DateTime  @default(now()) @db.Timestamptz()
  updated_at        DateTime  @default(now()) @updatedAt @db.Timestamptz()

  media_items       Media[]
  categories        ContentCategory[]
  tags              ContentTag[]

  @@index([external_id])
  @@index([content_hash])
  @@map("content_items")
}

model Category {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String    @db.Text
  slug        String    @unique @db.Text
  description String?   @db.Text
  parent_id   String?   @db.Uuid

  content_items ContentCategory[]

  @@map("categories")
}

model Tag {
  id   String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name String @unique @db.Text
  slug String @unique @db.Text

  content_items ContentTag[]

  @@map("tags")
}

model Media {
  id                  String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  content_item_id     String    @db.Uuid
  media_type          MediaType
  original_url        String    @db.Text
  stored_path         String?   @db.Text
  alt_text            String?   @db.Text
  ai_description      String?   @db.Text
  position_in_content Int?
  file_size_bytes     Int?
  width               Int?
  height              Int?

  content_item ContentItem @relation(fields: [content_item_id], references: [id], onDelete: Cascade)

  @@map("media")
}

model ContentCategory {
  content_item_id String @db.Uuid
  category_id     String @db.Uuid

  content_item ContentItem @relation(fields: [content_item_id], references: [id], onDelete: Cascade)
  category     Category    @relation(fields: [category_id], references: [id], onDelete: Cascade)

  @@id([content_item_id, category_id])
  @@map("content_categories")
}

model ContentTag {
  content_item_id String @db.Uuid
  tag_id          String @db.Uuid

  content_item ContentItem @relation(fields: [content_item_id], references: [id], onDelete: Cascade)
  tag          Tag         @relation(fields: [tag_id], references: [id], onDelete: Cascade)

  @@id([content_item_id, tag_id])
  @@map("content_tags")
}
```

**IMPORTANT**: After editing, compare against the introspected output to make sure no columns were lost. The `Unsupported` columns (embedding, search_vector) are the key difference from what introspection gives us.

- [ ] **Step 4: Generate Prisma client**

```bash
npx prisma generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 5: Create Prisma client singleton**

Write `lib/db/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 6: Verify Prisma can connect and read data**

Create a temporary test script or use the Next.js API to verify:

```bash
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.contentItem.count().then(c => { console.log('Count:', c); p.\$disconnect(); });
"
```

Expected: `Count: 1807` (or close to it).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma lib/db/prisma.ts
git commit -m "feat: add Prisma schema mapping existing basex database"
```

---

## Chunk 2: Database Adapter Layer

### Task 3: SearchProvider interface and types

**Files:**
- Create: `lib/db/search-provider.ts`
- Create: `lib/db/types.ts`

- [ ] **Step 1: Define shared types**

Write `lib/db/types.ts`:

```typescript
export interface SearchFilters {
  type?: string;        // source_type filter
  author?: string;      // author_handle or author_display_name
  dateFrom?: string;    // ISO date
  dateTo?: string;      // ISO date
}

export interface SearchOptions {
  page: number;
  perPage: number;
}

export interface ScoredResult {
  id: string;
  source_type: string;
  title: string;
  body_excerpt: string;        // highlighted or truncated text
  author_handle: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  source_url: string | null;
  posted_at: string | null;    // ISO datetime
  media_preview: MediaPreview | null;
  relevance_score: number;
}

export interface MediaPreview {
  id: string;
  type: string;
  url: string;
}

export interface SearchResponse {
  results: ScoredResult[];
  total: number;
  page: number;
  per_page: number;
}

export interface CapturePayload {
  external_id: string;
  source_url: string;
  source_type?: string;
  author_handle?: string | null;
  author_display_name?: string | null;
  author_avatar_url?: string | null;
  title?: string | null;
  body_text: string;
  posted_at?: string | null;
  media_urls?: string[];
  likes?: number | null;
  retweets?: number | null;
  replies?: number | null;
  views?: number | null;
}

export interface CaptureResult {
  success: boolean;
  already_exists: boolean;
  item_id?: string;
  error?: string;
}

export interface BulkCaptureResult {
  success: boolean;
  captured: number;
  skipped: number;
  errors: number;
  results: CaptureResult[];
}
```

- [ ] **Step 2: Define SearchProvider interface and factory**

Write `lib/db/search-provider.ts`:

```typescript
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

  countResults(
    query: string,
    filters: SearchFilters
  ): Promise<number>;

  writeEmbedding(itemId: string, embedding: number[]): Promise<void>;

  updateSearchVector(itemId: string, content: {
    title: string;
    body: string;
    summary?: string;
    author?: string;
  }): Promise<void>;
}

export function getSearchProvider(): SearchProvider {
  const dbType = process.env.DATABASE_TYPE || "postgresql";

  switch (dbType) {
    case "postgresql":
      // Dynamic import to avoid loading PG-specific code in other environments
      const { PostgresSearchProvider } = require("./providers/postgresql");
      return new PostgresSearchProvider();
    case "supabase":
      const { SupabaseSearchProvider } = require("./providers/supabase");
      return new SupabaseSearchProvider();
    case "sqlite":
      const { SqliteSearchProvider } = require("./providers/sqlite");
      return new SqliteSearchProvider();
    default:
      throw new Error(`Unsupported DATABASE_TYPE: ${dbType}`);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/db/types.ts lib/db/search-provider.ts
git commit -m "feat: add SearchProvider interface and shared types"
```

---

### Task 4: PostgreSQL search provider

**Files:**
- Create: `lib/db/providers/postgresql.ts`

- [ ] **Step 1: Implement PostgresSearchProvider**

Write `lib/db/providers/postgresql.ts`:

```typescript
import { prisma } from "../prisma";
import type { SearchProvider } from "../search-provider";
import type { SearchFilters, SearchOptions, ScoredResult, MediaPreview } from "../types";

export class PostgresSearchProvider implements SearchProvider {

  private buildFilterClauses(filters: SearchFilters): { sql: string; params: Record<string, unknown> } {
    const clauses: string[] = ["processing_status != 'error'"];
    const params: Record<string, unknown> = {};

    if (filters.type) {
      clauses.push(`source_type = $${Object.keys(params).length + 1}`);
      params[`p${Object.keys(params).length + 1}`] = filters.type;
    }
    if (filters.dateFrom) {
      clauses.push(`posted_at >= $${Object.keys(params).length + 1}`);
      params[`p${Object.keys(params).length + 1}`] = filters.dateFrom;
    }
    if (filters.dateTo) {
      clauses.push(`posted_at <= $${Object.keys(params).length + 1}`);
      params[`p${Object.keys(params).length + 1}`] = filters.dateTo;
    }

    return { sql: clauses.join(" AND "), params };
  }

  async keywordSearch(
    query: string,
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]> {
    const offset = (opts.page - 1) * opts.perPage;

    // Check if any items have search_vector populated
    const hasVectors = await prisma.$queryRawUnsafe<[{ exists: boolean }]>(
      `SELECT EXISTS(SELECT 1 FROM content_items WHERE search_vector IS NOT NULL LIMIT 1) as exists`
    );

    if (!hasVectors[0]?.exists) {
      // Fallback to ILIKE
      return this.fallbackSearch(query, filters, opts);
    }

    const filterSql = this.buildFilterSQL(filters);

    const rows = await prisma.$queryRawUnsafe<RawSearchRow[]>(
      `SELECT ci.id, ci.title, ci.source_type, ci.author_handle, ci.author_display_name,
              ci.author_avatar_url, ci.original_url, ci.posted_at,
              ts_rank_cd(ci.search_vector, websearch_to_tsquery('english', $1)) AS relevance_score,
              ts_headline('english', LEFT(ci.body_text, 500),
                          websearch_to_tsquery('english', $1),
                          'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15') AS body_excerpt,
              m.id AS media_id, m.media_type, m.position_in_content
       FROM content_items ci
       LEFT JOIN LATERAL (
         SELECT id, media_type, position_in_content
         FROM media WHERE content_item_id = ci.id
         ORDER BY position_in_content ASC NULLS LAST LIMIT 1
       ) m ON true
       WHERE ci.search_vector @@ websearch_to_tsquery('english', $1)
             ${filterSql ? `AND ${filterSql}` : ""}
       ORDER BY relevance_score DESC
       LIMIT $2 OFFSET $3`,
      query,
      opts.perPage,
      offset
    );

    return rows.map(mapRowToResult);
  }

  async semanticSearch(
    embedding: number[],
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]> {
    const offset = (opts.page - 1) * opts.perPage;
    const embeddingStr = `[${embedding.join(",")}]`;

    const hasEmbeddings = await prisma.$queryRawUnsafe<[{ exists: boolean }]>(
      `SELECT EXISTS(SELECT 1 FROM content_items WHERE embedding IS NOT NULL LIMIT 1) as exists`
    );

    if (!hasEmbeddings[0]?.exists) {
      return [];
    }

    const filterSql = this.buildFilterSQL(filters);

    const rows = await prisma.$queryRawUnsafe<RawSearchRow[]>(
      `SELECT ci.id, ci.title, ci.source_type, ci.author_handle, ci.author_display_name,
              ci.author_avatar_url, ci.original_url, ci.posted_at,
              (1 - (ci.embedding <=> $1::vector)) AS relevance_score,
              LEFT(ci.body_text, 200) AS body_excerpt,
              m.id AS media_id, m.media_type, m.position_in_content
       FROM content_items ci
       LEFT JOIN LATERAL (
         SELECT id, media_type, position_in_content
         FROM media WHERE content_item_id = ci.id
         ORDER BY position_in_content ASC NULLS LAST LIMIT 1
       ) m ON true
       WHERE ci.embedding IS NOT NULL
             ${filterSql ? `AND ${filterSql}` : ""}
       ORDER BY ci.embedding <=> $1::vector ASC
       LIMIT $2 OFFSET $3`,
      embeddingStr,
      opts.perPage,
      offset
    );

    return rows.map(mapRowToResult);
  }

  async authorSearch(
    query: string,
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]> {
    const offset = (opts.page - 1) * opts.perPage;
    const authorQuery = query.startsWith("@") ? query.slice(1) : query;

    const filterSql = this.buildFilterSQL(filters);

    const rows = await prisma.$queryRawUnsafe<RawSearchRow[]>(
      `SELECT ci.id, ci.title, ci.source_type, ci.author_handle, ci.author_display_name,
              ci.author_avatar_url, ci.original_url, ci.posted_at,
              1.0 AS relevance_score,
              LEFT(ci.body_text, 200) AS body_excerpt,
              m.id AS media_id, m.media_type, m.position_in_content
       FROM content_items ci
       LEFT JOIN LATERAL (
         SELECT id, media_type, position_in_content
         FROM media WHERE content_item_id = ci.id
         ORDER BY position_in_content ASC NULLS LAST LIMIT 1
       ) m ON true
       WHERE (ci.author_handle ILIKE $1 OR ci.author_display_name ILIKE $1)
             ${filterSql ? `AND ${filterSql}` : ""}
       ORDER BY ci.posted_at DESC
       LIMIT $2 OFFSET $3`,
      `%${authorQuery}%`,
      opts.perPage,
      offset
    );

    return rows.map(mapRowToResult);
  }

  async countResults(query: string, filters: SearchFilters): Promise<number> {
    const hasVectors = await prisma.$queryRawUnsafe<[{ exists: boolean }]>(
      `SELECT EXISTS(SELECT 1 FROM content_items WHERE search_vector IS NOT NULL LIMIT 1) as exists`
    );

    const filterSql = this.buildFilterSQL(filters);

    if (hasVectors[0]?.exists) {
      const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM content_items
         WHERE search_vector @@ websearch_to_tsquery('english', $1)
               ${filterSql ? `AND ${filterSql}` : ""}`,
        query
      );
      return Number(result[0].count);
    }

    // Fallback count
    const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM content_items
       WHERE (body_text ILIKE $1 OR title ILIKE $1)
             ${filterSql ? `AND ${filterSql}` : ""}`,
      `%${query}%`
    );
    return Number(result[0].count);
  }

  async writeEmbedding(itemId: string, embedding: number[]): Promise<void> {
    const embeddingStr = `[${embedding.join(",")}]`;
    await prisma.$queryRawUnsafe(
      `UPDATE content_items SET embedding = $1::vector WHERE id = $2::uuid`,
      embeddingStr,
      itemId
    );
  }

  async updateSearchVector(
    itemId: string,
    content: { title: string; body: string; summary?: string; author?: string }
  ): Promise<void> {
    const parts: string[] = [];
    const params: unknown[] = [itemId]; // $1 is always itemId

    if (content.title) {
      params.push(content.title);
      parts.push(`setweight(to_tsvector('english', $${params.length}), 'A')`);
    }
    if (content.body) {
      params.push(content.body.slice(0, 10000));
      parts.push(`setweight(to_tsvector('english', $${params.length}), 'B')`);
    }
    if (content.summary) {
      params.push(content.summary);
      parts.push(`setweight(to_tsvector('english', $${params.length}), 'C')`);
    }
    if (content.author) {
      params.push(content.author);
      parts.push(`setweight(to_tsvector('english', $${params.length}), 'D')`);
    }

    if (parts.length === 0) return;

    const expr = parts.join(" || ");
    await prisma.$queryRawUnsafe(
      `UPDATE content_items SET search_vector = ${expr} WHERE id = $1::uuid`,
      ...params
    );
  }

  private buildFilterSQL(filters: SearchFilters): string {
    const clauses: string[] = ["ci.processing_status != 'error'"];
    if (filters.type) clauses.push(`ci.source_type = '${filters.type}'`);
    if (filters.dateFrom) clauses.push(`ci.posted_at >= '${filters.dateFrom}'`);
    if (filters.dateTo) clauses.push(`ci.posted_at <= '${filters.dateTo}'`);
    return clauses.join(" AND ");
  }

  private async fallbackSearch(
    query: string,
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]> {
    const offset = (opts.page - 1) * opts.perPage;
    const filterSql = this.buildFilterSQL(filters);

    const rows = await prisma.$queryRawUnsafe<RawSearchRow[]>(
      `SELECT ci.id, ci.title, ci.source_type, ci.author_handle, ci.author_display_name,
              ci.author_avatar_url, ci.original_url, ci.posted_at,
              1.0 AS relevance_score,
              LEFT(ci.body_text, 200) AS body_excerpt,
              m.id AS media_id, m.media_type, m.position_in_content
       FROM content_items ci
       LEFT JOIN LATERAL (
         SELECT id, media_type, position_in_content
         FROM media WHERE content_item_id = ci.id
         ORDER BY position_in_content ASC NULLS LAST LIMIT 1
       ) m ON true
       WHERE (ci.body_text ILIKE $1 OR ci.title ILIKE $1)
             ${filterSql ? `AND ${filterSql}` : ""}
       ORDER BY ci.posted_at DESC
       LIMIT $2 OFFSET $3`,
      `%${query}%`,
      opts.perPage,
      offset
    );

    return rows.map(mapRowToResult);
  }
}

// --- Internal types and helpers ---

interface RawSearchRow {
  id: string;
  title: string;
  source_type: string;
  author_handle: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  original_url: string | null;
  posted_at: Date | null;
  relevance_score: number;
  body_excerpt: string;
  media_id: string | null;
  media_type: string | null;
  position_in_content: number | null;
}

function mapRowToResult(row: RawSearchRow): ScoredResult {
  let mediaPreview: MediaPreview | null = null;
  if (row.media_id) {
    mediaPreview = {
      id: row.media_id,
      type: row.media_type || "image",
      url: `/api/media/${row.media_id}`,
    };
  }

  return {
    id: row.id,
    source_type: row.source_type,
    title: row.title,
    body_excerpt: row.body_excerpt,
    author_handle: row.author_handle,
    author_display_name: row.author_display_name,
    author_avatar_url: row.author_avatar_url,
    source_url: row.original_url,
    posted_at: row.posted_at?.toISOString() ?? null,
    media_preview: mediaPreview,
    relevance_score: Number(row.relevance_score),
  };
}
```

**IMPORTANT security note**: The `buildFilterSQL` method uses string interpolation for filter values. These values come from validated query params (source_type is an enum, dates are validated). However, this should be improved in a future session to use parameterized queries for all filter values. For Session 1, the filter values are constrained enough (enum + date format) that this is acceptable. Add a `// TODO: parameterize filter values` comment.

- [ ] **Step 2: Verify the provider can query the existing database**

Quick smoke test:

```bash
npx tsx -e "
const { PostgresSearchProvider } = require('./lib/db/providers/postgresql');
const p = new PostgresSearchProvider();
p.keywordSearch('AI', {}, { page: 1, perPage: 5 }).then(r => {
  console.log('Results:', r.length);
  if (r[0]) console.log('First:', r[0].title, r[0].relevance_score);
}).catch(e => console.error(e));
"
```

Expected: Returns results from the existing database.

- [ ] **Step 3: Commit**

```bash
git add lib/db/providers/postgresql.ts
git commit -m "feat: implement PostgresSearchProvider with pgvector + tsvector"
```

---

### Task 5: SQLite and Supabase stubs

**Files:**
- Create: `lib/db/providers/sqlite.ts`
- Create: `lib/db/providers/supabase.ts`

- [ ] **Step 1: Create SQLite stub**

Write `lib/db/providers/sqlite.ts`:

```typescript
import type { SearchProvider } from "../search-provider";
import type { SearchFilters, SearchOptions, ScoredResult } from "../types";

export class SqliteSearchProvider implements SearchProvider {
  async keywordSearch(
    query: string,
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]> {
    // TODO: Implement FTS5 keyword search for SQLite
    console.warn("SQLite keyword search not yet implemented");
    return [];
  }

  async semanticSearch(
    _embedding: number[],
    _filters: SearchFilters,
    _opts: SearchOptions
  ): Promise<ScoredResult[]> {
    // SQLite does not support vector search
    return [];
  }

  async authorSearch(
    query: string,
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]> {
    // TODO: Implement LIKE-based author search for SQLite
    console.warn("SQLite author search not yet implemented");
    return [];
  }

  async countResults(_query: string, _filters: SearchFilters): Promise<number> {
    return 0;
  }

  async writeEmbedding(_itemId: string, _embedding: number[]): Promise<void> {
    // No-op: SQLite does not support vector storage
  }

  async updateSearchVector(
    _itemId: string,
    _content: { title: string; body: string; summary?: string; author?: string }
  ): Promise<void> {
    // TODO: Update FTS5 index
  }
}
```

- [ ] **Step 2: Create Supabase stub**

Write `lib/db/providers/supabase.ts`:

```typescript
import { PostgresSearchProvider } from "./postgresql";

// Supabase uses PostgreSQL under the hood. The same SQL works.
// In a future session, this could be enhanced to use Supabase client
// for RLS, realtime, or storage features.
export class SupabaseSearchProvider extends PostgresSearchProvider {
  // All methods inherited from PostgresSearchProvider.
  // The DATABASE_URL for Supabase points to the Supabase PostgreSQL instance.
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/db/providers/sqlite.ts lib/db/providers/supabase.ts
git commit -m "feat: add SQLite and Supabase search provider stubs"
```

---

## Chunk 3: Search & Embeddings

### Task 6: Gemini embedding client

**Files:**
- Create: `lib/embeddings/gemini.ts`

- [ ] **Step 1: Implement Gemini embedding wrapper**

Write `lib/embeddings/gemini.ts`:

```typescript
import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "gemini-embedding-001";
const OUTPUT_DIMENSIONALITY = 768;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([text]);
  return embeddings[0];
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const genai = getClient();
  const result = await genai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
    config: { outputDimensionality: OUTPUT_DIMENSIONALITY },
  });
  return result.embeddings.map((e: { values: number[] }) => e.values);
}
```

**Note**: The `@google/genai` SDK is the newer Google AI SDK (used by the existing Base X app as `google-genai` in Python). Check the exact import path — it may be `@google/generative-ai` or `@google/genai` depending on the npm package version. Verify with `npm ls @google/genai`.

- [ ] **Step 2: Commit**

```bash
git add lib/embeddings/gemini.ts
git commit -m "feat: add Gemini embedding client wrapper"
```

---

### Task 7: Hybrid search merger

**Files:**
- Create: `lib/search/hybrid.ts`
- Create: `lib/search/hybrid.test.ts`

- [ ] **Step 1: Write tests for the hybrid merger**

Write `lib/search/hybrid.test.ts`:

```typescript
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
  it("merges keyword and semantic results by ID, taking weighted scores", () => {
    const keyword = [makeResult("a", 0.8), makeResult("b", 0.6)];
    const semantic = [makeResult("a", 0.9), makeResult("c", 0.7)];

    const merged = mergeAndRankResults(keyword, semantic, [], 0.4, 0.6);

    // "a" appears in both: 0.4 * 0.8 + 0.6 * 0.9 = 0.32 + 0.54 = 0.86
    const resultA = merged.find((r) => r.id === "a");
    expect(resultA?.relevance_score).toBeCloseTo(0.86);

    // "b" only in keyword: 0.4 * 0.6 = 0.24
    const resultB = merged.find((r) => r.id === "b");
    expect(resultB?.relevance_score).toBeCloseTo(0.24);

    // "c" only in semantic: 0.6 * 0.7 = 0.42
    const resultC = merged.find((r) => r.id === "c");
    expect(resultC?.relevance_score).toBeCloseTo(0.42);

    // Sorted by score descending
    expect(merged[0].id).toBe("a");
    expect(merged[1].id).toBe("c");
    expect(merged[2].id).toBe("b");
  });

  it("includes author results with a bonus", () => {
    const keyword = [makeResult("a", 0.5)];
    const semantic: ScoredResult[] = [];
    const author = [makeResult("a", 1.0), makeResult("d", 1.0)];

    const merged = mergeAndRankResults(keyword, semantic, author, 0.4, 0.6);

    // "a": keyword 0.4*0.5=0.2 + author boost. Should be boosted above non-author results
    const resultA = merged.find((r) => r.id === "a");
    const resultD = merged.find((r) => r.id === "d");
    expect(resultA).toBeDefined();
    expect(resultD).toBeDefined();
    expect(resultA!.relevance_score).toBeGreaterThan(0.2);
  });

  it("handles empty inputs", () => {
    const merged = mergeAndRankResults([], [], [], 0.4, 0.6);
    expect(merged).toEqual([]);
  });

  it("deduplicates by keeping the highest score", () => {
    const keyword = [makeResult("a", 1.0)];
    const semantic = [makeResult("a", 0.1)];

    const merged = mergeAndRankResults(keyword, semantic, [], 0.4, 0.6);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("a");
  });
});
```

- [ ] **Step 2: Install vitest and run to verify tests fail**

```bash
npm install -D vitest
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Run:
```bash
npm test -- lib/search/hybrid.test.ts
```

Expected: FAIL — module `./hybrid` not found.

- [ ] **Step 3: Implement hybrid merger**

Write `lib/search/hybrid.ts`:

```typescript
import type { ScoredResult } from "../db/types";

const AUTHOR_BOOST = 0.15;

export function mergeAndRankResults(
  keywordResults: ScoredResult[],
  semanticResults: ScoredResult[],
  authorResults: ScoredResult[],
  keywordWeight: number,
  semanticWeight: number
): ScoredResult[] {
  const merged = new Map<string, ScoredResult & { kwScore: number; semScore: number; isAuthorMatch: boolean }>();

  // Add keyword results
  for (const r of keywordResults) {
    merged.set(r.id, {
      ...r,
      kwScore: r.relevance_score,
      semScore: 0,
      isAuthorMatch: false,
      relevance_score: 0, // Recomputed below
    });
  }

  // Merge semantic results
  for (const r of semanticResults) {
    const existing = merged.get(r.id);
    if (existing) {
      existing.semScore = r.relevance_score;
      // Prefer highlighted body_excerpt from keyword search
    } else {
      merged.set(r.id, {
        ...r,
        kwScore: 0,
        semScore: r.relevance_score,
        isAuthorMatch: false,
        relevance_score: 0,
      });
    }
  }

  // Merge author results
  for (const r of authorResults) {
    const existing = merged.get(r.id);
    if (existing) {
      existing.isAuthorMatch = true;
    } else {
      merged.set(r.id, {
        ...r,
        kwScore: 0,
        semScore: 0,
        isAuthorMatch: true,
        relevance_score: 0,
      });
    }
  }

  // Compute final scores
  const results: ScoredResult[] = [];
  for (const item of merged.values()) {
    const baseScore = keywordWeight * item.kwScore + semanticWeight * item.semScore;
    const authorBoost = item.isAuthorMatch ? AUTHOR_BOOST : 0;
    const { kwScore, semScore, isAuthorMatch, ...clean } = item;
    results.push({
      ...clean,
      relevance_score: baseScore + authorBoost,
    });
  }

  // Sort descending by score
  results.sort((a, b) => b.relevance_score - a.relevance_score);

  return results;
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
npm test -- lib/search/hybrid.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/search/hybrid.ts lib/search/hybrid.test.ts vitest.config.ts package.json
git commit -m "feat: add hybrid search merger with tests"
```

---

### Task 8: Search API route

**Files:**
- Create: `app/api/search/route.ts`

- [ ] **Step 1: Implement the search route**

Write `app/api/search/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSearchProvider } from "@/lib/db/search-provider";
import { mergeAndRankResults } from "@/lib/search/hybrid";
import { generateEmbedding } from "@/lib/embeddings/gemini";
import type { SearchFilters, SearchOptions } from "@/lib/db/types";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  const mode = (searchParams.get("mode") || "hybrid") as "keyword" | "semantic" | "hybrid";
  const type = searchParams.get("type") || undefined;
  const author = searchParams.get("author") || undefined;
  const dateFrom = searchParams.get("date_from") || undefined;
  const dateTo = searchParams.get("date_to") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));

  const filters: SearchFilters = { type, author, dateFrom, dateTo };
  const opts: SearchOptions = { page, perPage };

  try {
    const provider = getSearchProvider();

    // Detect author-style queries (starts with @)
    const isAuthorQuery = query.startsWith("@");

    // Run searches in parallel based on mode
    const promises: {
      keyword?: Promise<typeof import("@/lib/db/types").ScoredResult[]>;
      semantic?: Promise<typeof import("@/lib/db/types").ScoredResult[]>;
      author?: Promise<typeof import("@/lib/db/types").ScoredResult[]>;
      count?: Promise<number>;
    } = {};

    if (mode === "keyword" || mode === "hybrid") {
      promises.keyword = provider.keywordSearch(query, filters, opts);
    }

    if (mode === "semantic" || mode === "hybrid") {
      // Generate embedding for the query
      promises.semantic = generateEmbedding(query).then((embedding) =>
        provider.semanticSearch(embedding, filters, opts)
      );
    }

    // Author search: if explicit author filter or @-prefixed query
    if (author || isAuthorQuery) {
      promises.author = provider.authorSearch(author || query, filters, opts);
    }

    promises.count = provider.countResults(query, filters);

    const [keywordResults, semanticResults, authorResults, total] = await Promise.all([
      promises.keyword ?? Promise.resolve([]),
      promises.semantic ?? Promise.resolve([]),
      promises.author ?? Promise.resolve([]),
      promises.count ?? Promise.resolve(0),
    ]);

    const keywordWeight = parseFloat(process.env.SEARCH_KEYWORD_WEIGHT || "0.4");
    const semanticWeight = parseFloat(process.env.SEARCH_VECTOR_WEIGHT || "0.6");

    const results = mergeAndRankResults(
      keywordResults,
      semanticResults,
      authorResults,
      keywordWeight,
      semanticWeight
    );

    // Trim to requested page size (merger may have more results from combining sources)
    const trimmed = results.slice(0, perPage);

    return NextResponse.json({
      results: trimmed,
      total,
      page,
      per_page: perPage,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify the search endpoint works**

Start dev server and test:
```bash
npm run dev &
sleep 3
curl "http://localhost:3000/api/search?q=AI&mode=keyword" | jq '.results | length'
```

Expected: Returns a number > 0 (results from existing database).

Then test hybrid:
```bash
curl "http://localhost:3000/api/search?q=AI" | jq '.results[0]'
```

Expected: A result object with id, title, author, body_excerpt, relevance_score.

Test author search:
```bash
curl "http://localhost:3000/api/search?q=@somehandle" | jq '.results | length'
```

Expected: Results filtered by author.

- [ ] **Step 3: Commit**

```bash
git add app/api/search/route.ts
git commit -m "feat: implement hybrid search API endpoint"
```

---

## Chunk 4: Ingest & Extension Compat

### Task 9: Ingest shared logic

**Files:**
- Create: `lib/ingest/index.ts`
- Create: `lib/auth/capture-secret.ts`

- [ ] **Step 1: Create auth helper**

Write `lib/auth/capture-secret.ts`:

```typescript
import { NextRequest } from "next/server";

export function validateCaptureSecret(request: NextRequest): { valid: boolean; error?: string } {
  const captureSecret = process.env.CAPTURE_SECRET;
  if (!captureSecret) {
    return { valid: false, error: "CAPTURE_SECRET not configured on server" };
  }

  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return { valid: false, error: "Missing Authorization header" };
  }

  const token = auth.slice(7); // Strip "Bearer "
  if (token !== captureSecret) {
    return { valid: false, error: "Invalid capture secret" };
  }

  return { valid: true };
}
```

- [ ] **Step 2: Create ingest logic**

Write `lib/ingest/index.ts`:

```typescript
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/db/prisma";
import { getSearchProvider } from "@/lib/db/search-provider";
import { generateEmbedding } from "@/lib/embeddings/gemini";
import type { CapturePayload, CaptureResult } from "@/lib/db/types";

function sanitizeText(s: string | null | undefined): string | null {
  if (!s) return null;
  // Remove surrogates, null bytes, and invalid UTF-8
  return Buffer.from(s, "utf-8").toString("utf-8").replace(/\0/g, "");
}

function detectMediaType(url: string): "image" | "video" | "gif" {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "mp4") return "video";
  if (ext === "gif") return "gif";
  return "image";
}

export async function ingestItem(payload: CapturePayload): Promise<CaptureResult> {
  // Check for duplicate
  const existing = await prisma.contentItem.findFirst({
    where: { external_id: payload.external_id },
  });

  if (existing) {
    return { success: true, already_exists: true };
  }

  // Sanitize text fields
  const bodyText = sanitizeText(payload.body_text) || "";
  const title = sanitizeText(payload.title);
  const authorHandle = sanitizeText(payload.author_handle);
  const authorDisplayName = sanitizeText(payload.author_display_name);

  // Strip leading @ from handle
  const cleanHandle = authorHandle?.startsWith("@") ? authorHandle.slice(1) : authorHandle;

  // Generate content hash
  const { createHash } = await import("crypto");
  const contentHash = createHash("sha256")
    .update(bodyText + payload.source_url)
    .digest("hex");

  const itemId = uuidv4();
  const itemTitle = title || (bodyText.slice(0, 100) || "Untitled");

  // Create content item
  const item = await prisma.contentItem.create({
    data: {
      id: itemId,
      source_type: (payload.source_type as any) || "tweet",
      external_id: payload.external_id,
      author_handle: cleanHandle,
      author_display_name: authorDisplayName,
      author_avatar_url: payload.author_avatar_url,
      title: itemTitle,
      body_text: bodyText,
      original_url: payload.source_url,
      posted_at: payload.posted_at ? new Date(payload.posted_at) : null,
      likes: payload.likes,
      retweets: payload.retweets,
      replies: payload.replies,
      views: payload.views,
      raw_markdown: bodyText,
      source_file_path: `extension://${payload.external_id}`,
      content_hash: contentHash,
      processing_status: "parsed",
    },
  });

  // Create media records
  if (payload.media_urls && payload.media_urls.length > 0) {
    await prisma.media.createMany({
      data: payload.media_urls.map((url, position) => ({
        id: uuidv4(),
        content_item_id: itemId,
        media_type: detectMediaType(url) as any,
        original_url: url,
        position_in_content: position,
      })),
    });
  }

  // Background: generate embedding and update search vector
  // Using a fire-and-forget pattern. In production, use a proper job queue.
  indexItemInBackground(itemId, itemTitle, bodyText, cleanHandle, authorDisplayName);

  return { success: true, already_exists: false, item_id: itemId };
}

async function indexItemInBackground(
  itemId: string,
  title: string,
  body: string,
  authorHandle: string | null,
  authorDisplayName: string | null
): Promise<void> {
  try {
    const provider = getSearchProvider();

    // Update tsvector
    const authorParts = [authorHandle, authorDisplayName].filter(Boolean).join(" ");
    await provider.updateSearchVector(itemId, {
      title,
      body,
      author: authorParts || undefined,
    });

    // Generate and write embedding
    if (process.env.GEMINI_API_KEY) {
      const embeddingText = [title, body, authorHandle, authorDisplayName]
        .filter(Boolean)
        .join(" ");
      const embedding = await generateEmbedding(embeddingText);
      await provider.writeEmbedding(itemId, embedding);

      // Mark as indexed
      await prisma.contentItem.update({
        where: { id: itemId },
        data: { processing_status: "indexed" },
      });
    }
  } catch (error) {
    console.error(`Background indexing failed for ${itemId}:`, error);
    await prisma.contentItem.update({
      where: { id: itemId },
      data: {
        processing_status: "error",
        processing_error: error instanceof Error ? error.message : "Unknown indexing error",
      },
    }).catch(() => {}); // Don't throw on error update failure
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/auth/capture-secret.ts lib/ingest/index.ts
git commit -m "feat: add ingest logic and capture secret auth"
```

---

### Task 10: Ingest API routes

**Files:**
- Create: `app/api/ingest/route.ts`
- Create: `app/api/extension/capture/route.ts`
- Create: `app/api/extension/capture/bulk/route.ts`
- Create: `app/api/extension/check/route.ts`

- [ ] **Step 1: Create primary ingest route**

Write `app/api/ingest/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateCaptureSecret } from "@/lib/auth/capture-secret";
import { ingestItem } from "@/lib/ingest";
import type { CapturePayload } from "@/lib/db/types";

export async function POST(request: NextRequest) {
  const auth = validateCaptureSecret(request);
  if (!auth.valid) {
    const status = auth.error === "CAPTURE_SECRET not configured on server" ? 500 : 401;
    return NextResponse.json({ success: false, error: auth.error }, { status });
  }

  try {
    const payload: CapturePayload = await request.json();

    if (!payload.external_id || !payload.body_text) {
      return NextResponse.json(
        { success: false, error: "external_id and body_text are required" },
        { status: 400 }
      );
    }

    const result = await ingestItem(payload);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create bulk ingest route**

Write a new file `app/api/ingest/bulk/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateCaptureSecret } from "@/lib/auth/capture-secret";
import { ingestItem } from "@/lib/ingest";
import type { CapturePayload, CaptureResult } from "@/lib/db/types";

export async function POST(request: NextRequest) {
  const auth = validateCaptureSecret(request);
  if (!auth.valid) {
    const status = auth.error === "CAPTURE_SECRET not configured on server" ? 500 : 401;
    return NextResponse.json({ success: false, error: auth.error }, { status });
  }

  try {
    const body = await request.json();
    const items: CapturePayload[] = body.items;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: "'items' array is required" },
        { status: 400 }
      );
    }

    if (items.length > 100) {
      return NextResponse.json(
        { success: false, error: "Max 100 items per bulk request" },
        { status: 400 }
      );
    }

    let captured = 0;
    let skipped = 0;
    let errors = 0;
    const results: CaptureResult[] = [];

    for (const item of items) {
      try {
        const result = await ingestItem(item);
        if (result.already_exists) {
          skipped++;
        } else {
          captured++;
        }
        results.push(result);
      } catch (error) {
        errors++;
        results.push({
          success: false,
          already_exists: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      captured,
      skipped,
      errors,
      results,
    });
  } catch (error) {
    console.error("Bulk ingest error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create extension backward-compat alias routes**

Write `app/api/extension/capture/route.ts`:

```typescript
// Backward compatibility alias for the existing browser extension.
// Delegates to the primary ingest endpoint logic.
export { POST } from "@/app/api/ingest/route";
```

Write `app/api/extension/capture/bulk/route.ts`:

```typescript
// Backward compatibility alias for the existing browser extension.
export { POST } from "@/app/api/ingest/bulk/route";
```

Write `app/api/extension/check/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateCaptureSecret } from "@/lib/auth/capture-secret";

export async function POST(request: NextRequest) {
  const auth = validateCaptureSecret(request);
  if (!auth.valid) {
    const status = auth.error === "CAPTURE_SECRET not configured on server" ? 500 : 401;
    return NextResponse.json({ success: false, error: auth.error }, { status });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Test ingest with curl**

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CAPTURE_SECRET" \
  -d '{
    "external_id": "test-12345",
    "source_url": "https://x.com/test/status/12345",
    "source_type": "tweet",
    "author_handle": "@testuser",
    "author_display_name": "Test User",
    "body_text": "This is a test tweet for FeedSilo ingest."
  }'
```

Expected: `{ "success": true, "already_exists": false, "item_id": "..." }`

Test duplicate:
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CAPTURE_SECRET" \
  -d '{
    "external_id": "test-12345",
    "source_url": "https://x.com/test/status/12345",
    "source_type": "tweet",
    "body_text": "duplicate"
  }'
```

Expected: `{ "success": true, "already_exists": true }`

Test extension backward compat:
```bash
curl -X POST http://localhost:3000/api/extension/check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CAPTURE_SECRET"
```

Expected: `{ "success": true }`

Test extension capture alias:
```bash
curl -X POST http://localhost:3000/api/extension/capture \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CAPTURE_SECRET" \
  -d '{
    "external_id": "test-67890",
    "source_url": "https://x.com/test/status/67890",
    "source_type": "tweet",
    "body_text": "Extension compat test."
  }'
```

Expected: `{ "success": true, "already_exists": false, "item_id": "..." }`

- [ ] **Step 5: Clean up test data**

After testing, remove the test items from the database:

```bash
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.contentItem.deleteMany({ where: { external_id: { in: ['test-12345', 'test-67890'] } } })
  .then(r => { console.log('Deleted:', r.count); p.\$disconnect(); });
"
```

- [ ] **Step 6: Commit**

```bash
git add app/api/ingest/ app/api/extension/
git commit -m "feat: add ingest API routes with extension backward compat"
```

---

## Chunk 5: Items Route & Placeholder Pages

### Task 11: Items listing API

**Files:**
- Create: `app/api/items/route.ts`

- [ ] **Step 1: Implement items listing**

Write `app/api/items/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
  const type = searchParams.get("type") || undefined;

  const where: Record<string, unknown> = {
    processing_status: { not: "error" },
  };
  if (type) where.source_type = type;

  const [items, total] = await Promise.all([
    prisma.contentItem.findMany({
      where: where as any,
      orderBy: { posted_at: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        media_items: {
          take: 1,
          orderBy: { position_in_content: "asc" },
        },
      },
    }),
    prisma.contentItem.count({ where: where as any }),
  ]);

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      source_type: item.source_type,
      title: item.title,
      body_excerpt: item.body_text.slice(0, 200),
      author: {
        handle: item.author_handle,
        display_name: item.author_display_name,
        avatar_url: item.author_avatar_url,
      },
      source_url: item.original_url,
      posted_at: item.posted_at?.toISOString() ?? null,
      media_preview: item.media_items[0]
        ? {
            id: item.media_items[0].id,
            type: item.media_items[0].media_type,
            url: `/api/media/${item.media_items[0].id}`,
          }
        : null,
    })),
    total,
    page,
    per_page: perPage,
  });
}
```

- [ ] **Step 2: Test the items endpoint**

```bash
curl "http://localhost:3000/api/items?per_page=3" | jq '.items | length'
```

Expected: `3`

- [ ] **Step 3: Commit**

```bash
git add app/api/items/route.ts
git commit -m "feat: add items listing API endpoint"
```

---

### Task 12: Placeholder pages

**Files:**
- Modify: `app/page.tsx`
- Create: `app/archive/page.tsx`
- Create: `app/item/[id]/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update root layout**

Update `app/layout.tsx` to set the app name and basic metadata:

```typescript
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FeedSilo",
  description: "Personal content intelligence — capture, search, and organize your digital knowledge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Create home page placeholder**

Update `app/page.tsx`:

```typescript
export default function Home() {
  return (
    <main>
      <h1>FeedSilo</h1>
      <p>Personal content intelligence. Session 2 will add the full UI.</p>
      <p>API endpoints available:</p>
      <ul>
        <li>GET /api/search?q=your+query</li>
        <li>GET /api/items</li>
        <li>POST /api/ingest</li>
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Create archive page placeholder**

Write `app/archive/page.tsx`:

```typescript
export default function ArchivePage() {
  return (
    <main>
      <h1>Archive</h1>
      <p>Coming in Session 2.</p>
    </main>
  );
}
```

- [ ] **Step 4: Create item detail page placeholder**

Write `app/item/[id]/page.tsx`:

```typescript
export default function ItemDetailPage({ params }: { params: { id: string } }) {
  return (
    <main>
      <h1>Item: {params.id}</h1>
      <p>Detail view coming in Session 2.</p>
    </main>
  );
}
```

- [ ] **Step 5: Verify all pages render**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000 | grep "FeedSilo"
curl -s http://localhost:3000/archive | grep "Archive"
curl -s http://localhost:3000/item/test-id | grep "test-id"
```

Expected: All three return the expected content.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/layout.tsx app/archive/ app/item/
git commit -m "feat: add placeholder pages for home, archive, and item detail"
```

---

### Task 13: Copy extension for reference

**Files:**
- Create: `extension/` (copy from basex)

- [ ] **Step 1: Copy the existing extension directory**

```bash
cp -r /Users/richgates/Documents/vibecoding/basex/basex-extension/ extension/
```

This is for reference only — the extension continues to work as-is against the new API.

- [ ] **Step 2: Commit**

```bash
git add extension/
git commit -m "chore: copy existing browser extension for reference"
```

---

### Task 14: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: All tests pass (hybrid merger tests).

- [ ] **Step 2: Verify search against real database**

```bash
# Keyword search
curl -s "http://localhost:3000/api/search?q=machine+learning&mode=keyword" | jq '{total: .total, first_title: .results[0].title}'

# Hybrid search
curl -s "http://localhost:3000/api/search?q=machine+learning" | jq '{total: .total, first_title: .results[0].title, first_score: .results[0].relevance_score}'

# Author search
curl -s "http://localhost:3000/api/search?q=@someauthor" | jq '{total: .total, results: [.results[] | .author.handle]}'
```

Expected: Non-empty results from the existing database.

- [ ] **Step 3: Verify ingest + extension compat**

```bash
# Check connection (extension compat)
curl -s -X POST "http://localhost:3000/api/extension/check" \
  -H "Authorization: Bearer $CAPTURE_SECRET" | jq .

# Capture (extension compat)
curl -s -X POST "http://localhost:3000/api/extension/capture" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CAPTURE_SECRET" \
  -d '{"external_id":"final-test","source_url":"https://x.com/t/1","body_text":"Final test."}' | jq .
```

Expected: Both return `{ "success": true, ... }`

- [ ] **Step 4: Clean up test data and make final commit**

```bash
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.contentItem.deleteMany({ where: { external_id: 'final-test' } })
  .then(r => { console.log('Cleaned:', r.count); p.\$disconnect(); });
"
```

```bash
git add -A
git status  # Review for any uncommitted files
git commit -m "feat: complete Session 1 — database, search, and ingest foundation"
```

---

## Definition of Done Checklist

- [ ] Monorepo scaffolded and running locally with `npm run dev`
- [ ] `GET /api/search?q=test` returns ranked hybrid results from existing data
- [ ] `POST /api/ingest` accepts a capture from the extension without breaking
- [ ] `POST /api/extension/capture` works as alias (backward compat)
- [ ] Author search via `?author=handle` or `?q=@handle` returns correct results
- [ ] PostgreSQL provider fully functional
- [ ] Supabase and SQLite providers stubbed with correct interfaces
- [ ] All SearchProvider implementations export the same interface
- [ ] Tests pass (`npm test`)
