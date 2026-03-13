# Session 3: Onboarding, Settings & Multi-Backend — Design Spec

## Goal

A developer goes from `git clone` to first captured tweet in under 10 minutes, regardless of database backend. Three user paths (SQLite, PostgreSQL, Supabase) each feel tailored. A settings page gives full control over configuration after initial setup.

## Architecture

Chunked session with three independent implementation cycles:

1. **Chunk 1: Config System + Data Layer Refactoring** — Foundation: config file, dual Prisma schemas, SQLite FTS5 search, first-run detection, auto-migration
2. **Chunk 2: Onboarding Flow** — 4-step wizard UI with Framer Motion transitions
3. **Chunk 3: Settings Page + Header** — Full settings with SSE progress streams, extracted header component

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| SQLite support | Real — dual Prisma schemas, FTS5 | Delivers "2 min zero-infra" promise |
| Vector search on SQLite | Disabled — keyword only | SQLite positioned as quick-start; upgrade to PG for full features |
| Config persistence | `feedsilo.config.json` + `.env.local` | Runtime config + Prisma CLI compatibility |
| Database migration | Auto-migrate on first connection | Zero-friction setup |
| Data layer approach | Dual Prisma schemas, dynamic client loading | Clean separation, maintainable |
| Session structure | 3 chunks, each brainstorm→plan→implement | Proven approach from Session 2 |

---

## Chunk 1: Config System + Data Layer Refactoring

### Config Resolution

Priority order (highest first):
1. Environment variables (`DATABASE_URL`, `DATABASE_TYPE`, `GEMINI_API_KEY`, etc.)
2. `feedsilo.config.json` in project root (gitignored)
3. Defaults (no database configured → triggers onboarding)

### Config File Schema

```json
{
  "database": {
    "type": "postgresql",
    "url": "postgresql://user:pass@host:5432/dbname"
  },
  "embeddings": {
    "provider": "gemini",
    "apiKey": "..."
  },
  "extension": {
    "pairingToken": "uuid-v4-token"
  },
  "search": {
    "keywordWeight": 0.4,
    "semanticWeight": 0.6
  }
}
```

Validated with Zod schema. Written by onboarding, read at runtime.

### Dual Prisma Schemas

**PostgreSQL** (`prisma/schema.prisma` — existing):
- Provider: `postgresql`
- Includes `vector(768)` column, `tsvector` column, pgvector extension, GIN index
- Generated to `lib/generated/prisma/`

**SQLite** (`prisma/schema-sqlite.prisma` — new):
- Provider: `sqlite`
- Omits vector and tsvector columns entirely
- No pgvector extension declaration
- Generated to `lib/generated/prisma-sqlite/`
- FTS5 virtual table created via raw SQL migration:
  ```sql
  CREATE VIRTUAL TABLE content_items_fts USING fts5(title, body_text, summary, author_handle);
  ```

### Dynamic Client Loading

Refactor `lib/db/prisma.ts`:
- Reads config to determine database type
- PostgreSQL/Supabase → imports from `lib/generated/prisma/` (PG client with `@prisma/adapter-pg`)
- SQLite → imports from `lib/generated/prisma-sqlite/` (SQLite client)
- Exports `getClient()` async factory instead of bare `prisma` singleton
- All `lib/db/queries.ts` functions updated to use `getClient()`

### SQLite Search Provider (Real Implementation)

Replace the stub in `lib/db/providers/sqlite.ts`:
- `keywordSearch`: FTS5 `MATCH` query with `bm25()` ranking
- `authorSearch`: `LIKE` on author_handle and author_display_name
- `countResults`: `SELECT COUNT(*)` with FTS5 WHERE clause
- `semanticSearch`: Returns empty array (disabled)
- `writeEmbedding`: No-op (disabled)
- `updateSearchVector`: Inserts/updates row in `content_items_fts` virtual table

### First-Run Detection

`middleware.ts`:
- Checks if `feedsilo.config.json` exists AND has valid `database.type` + `database.url`
- If not configured → redirect to `/onboarding`
- Exempt paths: `/onboarding/*`, `/api/setup/*`, `/_next/*`, `/favicon.ico`
- Reads config synchronously via `fs.existsSync` + `fs.readFileSync` (fast for local file)
- No module-scope caching — middleware runs per-request but file reads are sub-millisecond
- If `feedsilo.config.json` exists but is malformed JSON → treat as "not configured" → redirect to onboarding (log a warning)

### API Endpoints (Chunk 1)

**`GET /api/setup/status`**
Returns: `{ configured: boolean, databaseType: string | null }`

**`POST /api/setup/test-connection`**
Body: `{ type: "postgresql" | "supabase" | "sqlite", url?: string, host?: string, port?: number, database?: string, username?: string, password?: string, supabaseUrl?: string, supabaseAnonKey?: string, supabaseServiceKey?: string }`
Returns: `{ connected: boolean, pgvector: boolean, error?: string }`

On success for PG/Supabase: also checks for pgvector extension availability.
On success for SQLite: verifies write permissions at the file path.

### Auto-Migration

Triggered by a separate `POST /api/setup/migrate` endpoint (called by the frontend after successful connection test):

1. Write config files (`feedsilo.config.json` + `.env.local`)
2. Run `prisma db push --schema=prisma/schema.prisma` (PG) or `prisma db push --schema=prisma/schema-sqlite.prisma` (SQLite) via child process. Using `db push` instead of `migrate deploy` because no migration history exists in a fresh clone.
3. For SQLite: also execute raw SQL to create FTS5 virtual table
4. For PG: also attempt `CREATE EXTENSION IF NOT EXISTS vector` (non-fatal if it fails — user may not have superuser)

### Package.json Scripts

Add dual-generate script:
```json
"prisma:generate": "prisma generate --schema=prisma/schema.prisma && prisma generate --schema=prisma/schema-sqlite.prisma",
"postinstall": "npm run prisma:generate"
```

### New Dependencies

- `canvas-confetti` — confetti animation on onboarding completion
- `better-sqlite3` + `@types/better-sqlite3` — SQLite driver for Prisma SQLite client

### Auth Token Migration

The existing `CAPTURE_SECRET` env var (used by `lib/auth/capture-secret.ts`) becomes a fallback. Resolution order:
1. `CAPTURE_SECRET` env var (for Docker/production deployments)
2. `extension.pairingToken` from `feedsilo.config.json` (for local/onboarding setups)

`lib/auth/capture-secret.ts` is updated to read from config if env var is not set. The extension check endpoint (`/api/extension/check`) continues to work with either source.

### SQLite-Safe Query Guards

`fetchRelatedItems` in `queries.ts` uses a pgvector cosine distance query that will crash on SQLite. Guard this:
- If database type is SQLite → return empty array (related items require vector search)
- Same pattern for any other pgvector-dependent queries

`getSearchProvider()` in `search-provider.ts` is updated to read database type from the config module instead of `process.env.DATABASE_TYPE` directly. The module-level `_cachedProvider` is invalidated when database type changes (settings "Switch Database").

---

## Chunk 2: Onboarding Flow

### Page Structure

`app/onboarding/page.tsx` — Client component with internal step state (1-4). Step state persisted in `sessionStorage` so browser back/refresh doesn't lose progress.

### Step 1: Welcome

- FeedSilo logo/wordmark centered (reuse existing logo pattern from home-page)
- Headline: "Your personal content intelligence feed"
- Three bullet points (max) explaining what it does
- Single CTA: "Get Started" button
- Small text: "Open source, MIT licensed, your data stays yours"

### Step 2: Choose Database

- Headline: "Where should FeedSilo store your data?"
- Three selectable `DatabaseCard` components:
  - **SQLite** (cyan accent): "Local SQLite — Zero infrastructure. Everything stored locally. Best for personal use." Badge: "Fastest Setup"
  - **PostgreSQL** (purple accent): "PostgreSQL — Self-hosted database. Full control, best performance, supports semantic search via pgvector." Badge: "Recommended"
  - **Supabase** (amber accent): "Supabase — Managed PostgreSQL with built-in vector search. Easiest cloud option." Badge: "Best for Cloud"
- Selected card: full border glow, unselected dimmed
- Continue button disabled until selection

### Step 3: Configure Connection

Renders conditionally based on Step 2 selection.

**SQLite path:**
- Default file path input (`./feedsilo.db`), pre-filled
- Note: "Your database file will be created automatically on first run"
- Nearly zero friction — most users just click Continue

**PostgreSQL path:**
- Connection string input (primary)
- Toggle: "Enter fields separately" → reveals host, port, database, username, password
- "Test Connection" button appears after input
- On test: spinner → green checkmark "Connected" / red error with actual message
- If pgvector missing: yellow warning with link to pgvector docs
- If connection fails: show actual error, not generic message

**Supabase path:**
- Project URL input
- Anon key input
- Service role key input (with explanation note)
- "Test Connection" button
- Link to Supabase dashboard

All paths: auto-migration runs on successful connection test.

### Step 4: Connect Extension

- Headline: "Connect the FeedSilo browser extension"
- Pairing token display (generated uuid v4, stored in config)
- Copy button with "Copied!" flash
- Instructions: "Copy this token, open the FeedSilo extension, paste it in the settings tab"
- "I'll do this later" skip option
- Final CTA: "Open FeedSilo" → routes to `/`
- `canvas-confetti` animation on completion

### Transitions

Framer Motion AnimatePresence:
- Advance: current step slides left + fades out, next slides in from right
- Back: current slides right + fades out, previous slides in from left
- Duration: ~300ms, ease-out

### Component Structure

```
components/onboarding/
  onboarding-layout.tsx       — Progress indicator (4 dots), centered container, AnimatePresence
  database-card.tsx            — Selectable card with accent color, badge, glow state
  steps/
    welcome-step.tsx           — Logo, headline, bullets, CTA
    database-step.tsx          — 3 DatabaseCards, continue button
    configure-step.tsx         — Conditional forms per backend, ConnectionTester integration
    extension-step.tsx         — TokenDisplay, copy, skip, confetti
```

---

## Chunk 3: Settings Page + Header

### Header Extraction

Extract the inline header from `components/home-page.tsx` into standalone `components/header.tsx`:
- Logo (feed·silo) on left
- Capture count in center/right
- Gear icon (lucide-react `Settings`) linking to `/settings` on far right
- Used in both home-page and settings page

### Settings Page Structure

`app/settings/page.tsx` — Server component shell, settings-layout client component.

### Section: Database

- Current backend shown with green/red status dot
- Connection string (masked by default, show/hide toggle)
- "Test Connection" button → uses `ConnectionTester` component
- "Switch Database" button → opens modal with onboarding Steps 2-3. Warning: "Switching databases does not migrate data. Your existing data will remain in the current database."

### Section: Extension

- Pairing token display with `TokenDisplay` component
- "Regenerate Token" button with confirmation dialog
- Connection status: last extension ping timestamp, captures today count

### Section: Search

- Semantic search toggle (disabled with explanation if SQLite or no pgvector)
- "Advanced Search Settings" disclosure:
  - Keyword weight slider (0-100, default mapped from config)
  - Semantic weight slider (0-100, default mapped from config)
- "Rebuild Search Index" button with SSE progress bar

### Section: Embeddings

- Gemini API key input (masked, show/hide)
- Embedding model display: "gemini-embedding-001" (matches `lib/embeddings/gemini.ts` constant)
- Coverage stats: "X of Y items have embeddings"
- "Generate Missing Embeddings" button with SSE progress bar
- Estimated cost display

### Section: Data

- Total items count by type (reuse fetchStats)
- Database size (PG: `pg_database_size()` query via API; SQLite: `fs.statSync` on db file path from config, returned via `GET /api/settings`)
- "Export as JSON" button
- "Export as CSV" button
- Danger zone: "Delete All Data" with `DangerZone` component (type "DELETE" to confirm)

### Shared Components

```
components/shared/
  connection-tester.tsx        — Button → spinner → checkmark/error, pgvector status
  progress-bar.tsx             — Animated fill + percentage + status text, driven by SSE EventSource
  token-display.tsx            — Monospace token, copy button, "Copied!" flash
  danger-zone.tsx              — Red border section, modal requiring "DELETE" typed to confirm
```

### API Endpoints (Chunk 3)

**`GET /api/settings`** — Returns current settings (sensitive values masked)
**`POST /api/settings`** — Updates settings, rewrites config files
Body: `{ database?: { type, url }, embeddings?: { apiKey }, search?: { keywordWeight, semanticWeight } }`
Partial updates — only provided fields are changed. Rewrites `feedsilo.config.json` + `.env.local`.
Returns: `{ success: boolean }`

**`POST /api/settings/regenerate-token`** — New uuid v4 token, invalidates old
UI warns: "Any connected browser extension will need to be re-paired with the new token."
Returns: `{ token: string }`

**`DELETE /api/data`** — Deletes all content data
Deletes all rows from: `content_items` (cascades to `media`, `content_categories`, `content_tags`). Does NOT delete categories/tags themselves. For SQLite: also clears `content_items_fts` virtual table. For PG: does NOT drop pgvector extension or tsvector index.
Body: `{ confirmation: "DELETE" }` (server validates this matches)
Returns: `{ success: boolean, deletedCount: number }`

**`GET /api/search/reindex`** — SSE stream: rebuilds tsvector/FTS5 for all items
**`GET /api/embeddings/generate-missing`** — SSE stream: generates embeddings for items missing them

Note: These use GET (not POST) because `EventSource` only supports GET requests.

**`GET /api/export?format=json|csv`** — Streams full data export
- JSON: streams NDJSON (one JSON object per line) with Content-Type `application/x-ndjson`, Content-Disposition `attachment; filename="feedsilo-export.json"`
- CSV: streams with Content-Type `text/csv`, Content-Disposition `attachment; filename="feedsilo-export.csv"`
- Columns: id, source_type, title, body_text, author_handle, author_display_name, original_url, posted_at, created_at, engagement stats
- Uses Node.js `ReadableStream` for memory-efficient streaming of large datasets

### SSE Progress Protocol

```
Client: const es = new EventSource('/api/embeddings/generate-missing')

Server streams (Content-Type: text/event-stream):
  data: {"progress":0.12,"processed":45,"total":380,"current":"Processing @elonmusk tweet"}
  data: {"progress":0.13,"processed":46,"total":380,"current":"Processing @naval thread"}
  ...
  data: {"progress":1.0,"processed":380,"total":380,"done":true}

Client: ProgressBar updates in real time. Closes on done:true.
On connection drop: ProgressBar shows "Connection lost" with a "Retry" button.
```

---

## What We're NOT Building

- User authentication (future session)
- Multi-user / team features
- sqlite-vec (vector search on SQLite)
- QR code for extension pairing
- Archive page (stays as stub)
- Modifications to Session 1/2 components beyond header extraction and `getClient()` refactor

## Definition of Done

- Fresh `git clone` + `npm run dev` lands on onboarding automatically
- All three database paths complete successfully and write config
- PostgreSQL and Supabase paths test connection with real feedback
- Settings page loads and displays current configuration correctly
- Reindex and embedding generation show real SSE progress
- Export works for both JSON and CSV
- Extension pairing token can be copied and regenerated
- No console errors
- Mobile layout works for onboarding flow
