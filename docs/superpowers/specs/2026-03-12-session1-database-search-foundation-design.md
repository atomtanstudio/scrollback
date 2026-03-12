# FeedSilo Session 1: Database & Search Foundation

## Overview

Rebuild the Base X personal content intelligence tool as FeedSilo — a Next.js 14 App Router monorepo with hybrid search (keyword + semantic) over captured Twitter/X content. Session 1 establishes the database layer, search API, and ingest endpoint.

## Constraints

- **No Docker** — npm install, configure .env, run. Simple onboarding for open source.
- **No destructive migrations** — the existing `basex` PostgreSQL database with ~1807 rows must be preserved as-is.
- **No auth** — that's a later session.
- **No frontend styling** — that's Session 2.
- **Preserve extension contract** — the existing browser extension posts to `/api/extension/capture` with Bearer token auth.

## Architecture

### Approach: Prisma CRUD + Search Adapter

- **Prisma** handles schema, types, migrations, and all standard CRUD (create items, fetch by ID, list).
- **SearchProvider interface** with backend-specific implementations handles search queries via `prisma.$queryRawUnsafe()`.
- Embedding and tsvector columns use `Unsupported()` in Prisma schema (can't be read/written via normal Prisma methods, only raw SQL).

### Project Structure

```
feedsilo/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── archive/page.tsx
│   ├── item/[id]/page.tsx
│   └── api/
│       ├── search/route.ts
│       ├── items/route.ts
│       ├── ingest/route.ts
│       └── extension/
│           ├── capture/route.ts
│           ├── capture/bulk/route.ts
│           └── check/route.ts
├── components/
│   ├── search/
│   ├── cards/
│   └── ui/
├── lib/
│   ├── db/
│   │   ├── prisma.ts
│   │   ├── search-provider.ts
│   │   └── providers/
│   │       ├── postgresql.ts
│   │       ├── supabase.ts
│   │       └── sqlite.ts
│   ├── search/
│   │   └── hybrid.ts
│   └── embeddings/
│       └── gemini.ts
├── prisma/
│   └── schema.prisma
├── extension/
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Database Schema

Generated via `prisma db pull` from existing `basex` database, then cleaned up. Maps 1:1 to existing tables.

### content_items (primary table)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, default uuid4 |
| source_type | Enum | tweet, article, thread, image_prompt, video_prompt, unknown |
| external_id | Text | Nullable, indexed. Dedup key from extension |
| author_handle | Text | Nullable |
| author_display_name | Text | Nullable |
| author_avatar_url | Text | Nullable |
| title | Text | Required |
| body_text | Text | Required |
| body_html | Text | Nullable |
| original_url | Text | Nullable |
| posted_at | DateTime(tz) | Nullable |
| likes, retweets, replies, views | Int | Nullable engagement stats |
| has_prompt | Boolean | Default false |
| prompt_text | Text | Nullable |
| prompt_type | Enum | image, video, text. Nullable |
| language | Text | Nullable |
| ai_summary | Text | Nullable |
| raw_markdown | Text | Required |
| source_file_path | Text | Required, unique |
| content_hash | Text | Required, indexed |
| processing_status | Enum | parsed, enriched, media_downloaded, categorized, indexed, error |
| processing_error | Text | Nullable |
| embedding | Unsupported("vector(768)") | pgvector. Nullable |
| search_vector | Unsupported("tsvector") | Full-text search. Nullable |
| created_at | DateTime(tz) | Default now |
| updated_at | DateTime(tz) | Default now, auto-update |

### Related tables

- **categories**: id, name, slug, description, parent_id (self-referential)
- **tags**: id, name, slug
- **media**: id, content_item_id (FK), media_type (image/video/gif), original_url, stored_path, alt_text, ai_description, position_in_content, dimensions
- **content_categories**: content_item_id + category_id (join table)
- **content_tags**: content_item_id + tag_id (join table)

## Search API

### GET /api/search

**Query params:**
- `q` (string, required)
- `mode` ("keyword" | "semantic" | "hybrid", default "hybrid")
- `type` (source_type filter)
- `author` (string — explicit ILIKE on author_handle + author_display_name)
- `date_from`, `date_to` (ISO dates)
- `page` (default 1), `per_page` (default 20, max 100)

**Search flow:**
1. `keywordSearch()`: PostgreSQL `websearch_to_tsquery` + `ts_rank_cd` on `search_vector`. SQLite: FTS5. Fallback: ILIKE.
2. `semanticSearch()` (if mode != "keyword"): Generate query embedding via Gemini, then `1 - (embedding <=> query_vector)` cosine similarity.
3. **Author boost**: If query starts with `@` or `author` param is set, explicit `ILIKE` on `author_handle` and `author_display_name` columns (not just tsvector).
4. **Merge & rank**: Configurable weights (default 0.4 keyword / 0.6 semantic). Deduplicate by ID. Include media preview from first media item.

**Response:**
```json
{
  "results": [{
    "id": "uuid",
    "source_type": "tweet",
    "title": "...",
    "body_excerpt": "...with <mark>highlights</mark>...",
    "author": { "handle": "...", "display_name": "...", "avatar_url": "..." },
    "source_url": "https://x.com/...",
    "posted_at": "2024-...",
    "media_preview": { "id": "uuid", "type": "image", "url": "/api/media/..." } | null,
    "relevance_score": 0.87
  }],
  "total": 142,
  "page": 1,
  "per_page": 20
}
```

## Ingest API

### POST /api/ingest (aliased at /api/extension/capture)

**Auth**: Bearer token via `CAPTURE_SECRET` env var.

**Request body** (preserves existing extension contract exactly):
```json
{
  "external_id": "1234567890",
  "source_url": "https://x.com/user/status/1234567890",
  "source_type": "tweet",
  "author_handle": "username",
  "author_display_name": "Display Name",
  "author_avatar_url": "https://...",
  "title": null,
  "body_text": "Tweet content...",
  "posted_at": "2024-01-15T10:30:00Z",
  "media_urls": ["https://pbs.twimg.com/..."],
  "likes": 42,
  "retweets": 5,
  "replies": 3,
  "views": 1200
}
```

**Flow:**
1. Validate Bearer token
2. Check `external_id` for duplicates
3. Sanitize text (strip surrogates/null bytes), strip leading `@` from handle
4. Create `content_items` row via Prisma
5. Create `media` rows for each media_url
6. Return `{ success: true, already_exists: false, item_id: "uuid" }`
7. Background: generate embedding via Gemini, update tsvector

### POST /api/ingest/bulk (aliased at /api/extension/capture/bulk)

Same payload in `{ items: [...] }`, max 100. Returns `{ success, captured, skipped, errors, results }`.

### POST /api/extension/check

Auth check only. Returns `{ success: true }`.

## SearchProvider Interface

```typescript
interface SearchProvider {
  keywordSearch(query: string, filters: SearchFilters, opts: SearchOptions): Promise<ScoredResult[]>
  semanticSearch(embedding: number[], filters: SearchFilters, opts: SearchOptions): Promise<ScoredResult[]>
  authorSearch(query: string, filters: SearchFilters, opts: SearchOptions): Promise<ScoredResult[]>
  writeEmbedding(itemId: string, embedding: number[]): Promise<void>
  updateSearchVector(itemId: string, text: string): Promise<void>
}
```

**Implementations:**
- `PostgresSearchProvider`: Full pgvector + tsvector via raw SQL
- `SupabaseSearchProvider`: Extends PostgresSearchProvider (same SQL, different connection)
- `SqliteSearchProvider`: FTS5 keyword search. `semanticSearch()` returns `[]`. Stub for now.

Factory function reads `DATABASE_TYPE` env var.

## Onboarding (Open Source Priority)

### Existing Base X users
```bash
git clone feedsilo && cd feedsilo
npm install
cp .env.example .env   # Point DATABASE_URL to existing basex DB
npx prisma db pull      # Introspect existing schema
npx prisma generate
npm run dev
```

### New users (PostgreSQL)
```bash
git clone feedsilo && cd feedsilo
npm install
cp .env.example .env   # Set DATABASE_URL, GEMINI_API_KEY
npx prisma db push      # Create tables
npm run dev
```

### New users (SQLite zero-config)
```bash
git clone feedsilo && cd feedsilo
npm install
cp .env.example .env   # DATABASE_URL="file:./feedsilo.db"
npx prisma db push
npm run dev
```

No Docker. No containers. Just Node.js and npm.

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/basex
DATABASE_TYPE=postgresql  # postgresql | supabase | sqlite
GEMINI_API_KEY=           # For embeddings
CAPTURE_SECRET=           # Shared secret for extension auth
NEXT_PUBLIC_APP_URL=http://localhost:3000
SEARCH_KEYWORD_WEIGHT=0.4
SEARCH_VECTOR_WEIGHT=0.6
```

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Prisma ORM
- shadcn/ui (base component layer)
- framer-motion (installed, not used until Session 2)
- @google/genai (Gemini embeddings)
- pgvector (PostgreSQL extension)

## Definition of Done

- [ ] Monorepo scaffolded and running locally with `npm run dev`
- [ ] `GET /api/search?q=test` returns ranked hybrid results from existing data
- [ ] `POST /api/ingest` accepts a capture from the extension without breaking
- [ ] `POST /api/extension/capture` works as alias (backward compat)
- [ ] Author search via `?author=handle` or `?q=@handle` returns correct results
- [ ] PostgreSQL provider fully functional
- [ ] Supabase and SQLite providers stubbed with correct interfaces
- [ ] All SearchProvider implementations export the same interface
