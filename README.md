# FeedSilo

Personal content intelligence tool. Capture tweets, threads, articles, and AI art prompts — then find anything instantly with hybrid search (keyword + semantic).

Built with Next.js 14, Prisma, and PostgreSQL (pgvector).

## Features

- **Capture** — Browser extension saves content with one click
- **Hybrid Search** — Full-text (tsvector) + semantic (pgvector embeddings) search
- **Masonry Feed** — Pinterest-style layout with infinite scroll
- **Detail Pages** — Newspaper-style content view with engagement stats, thread chains, and related items
- **Multi-Database** — PostgreSQL, Supabase, or SQLite
- **Embeddings** — Google Gemini for vector embeddings (optional)
- **Media Storage** — Cloudflare R2 for persistent media storage (optional)
- **Export** — JSON (NDJSON) and CSV export

## Quick Start

```bash
# Install dependencies (auto-generates Prisma clients)
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the onboarding wizard will walk you through database setup.

## Environment Variables

For local development, copy `.env.example` to `.env.local` and fill in your values, or use the onboarding wizard which writes it for you.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DATABASE_TYPE` | Yes | `postgresql`, `supabase`, or `sqlite` |
| `AUTH_SECRET` | Yes for hosted deploys | Secret used by Auth.js for login sessions |
| `GEMINI_API_KEY` | No | Google Gemini API key for embeddings |
| `CAPTURE_SECRET` | No | Browser extension pairing token |
| `SEARCH_KEYWORD_WEIGHT` | No | Keyword search weight (default: `0.4`) |
| `SEARCH_VECTOR_WEIGHT` | No | Semantic search weight (default: `0.6`) |
| `R2_ACCOUNT_ID` | No | Cloudflare account ID (for media storage) |
| `R2_ACCESS_KEY_ID` | No | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | No | R2 API token secret key |
| `R2_BUCKET_NAME` | No | R2 bucket name (e.g. `feedsilo-media`) |

## Production Deploy

For hosted deploys (VPS, Vercel, Railway, etc.). The onboarding wizard is for local dev only.

### 1. PostgreSQL with pgvector

FeedSilo requires the `vector` extension. Use a pgvector-enabled image like `pgvector/pgvector:pg16`.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Environment variables

Set these in your hosting platform:

**Required:**

- `DATABASE_URL` — PostgreSQL connection string
- `DATABASE_TYPE=postgresql`
- `AUTH_SECRET` — generate with `openssl rand -hex 32`

**Recommended:**

- `CAPTURE_SECRET` — browser extension pairing token (`openssl rand -hex 32`)
- `NODE_ENV=production`

**Optional:**

- `GEMINI_API_KEY` — enables semantic search and AI classification
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` — Cloudflare R2 media storage
- `XAPI_BEARER_TOKEN`, `XAPI_CONSUMER_KEY`, `XAPI_CONSUMER_SECRET`, `XAPI_CLIENT_ID`, `XAPI_CLIENT_SECRET`, `XAPI_ENCRYPTION_KEY` — X API integration for bookmark/like sync

### 3. Build and start

```bash
npm run db:push && npm run start
```

This applies the schema and launches the app. With env vars set, onboarding is skipped.

### 4. Create admin account

After the app starts, open `/login`. If no admin exists, you'll see a "Create admin account" form.

### 5. Branches

- **`main`** — Stable releases. Use this for self-hosting.
- **`dev`** — Active development. May break without notice.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:push` | Apply database schema (PostgreSQL) |
| `npm run test` | Run tests |
| `npm run lint` | Run ESLint |

## Tech Stack

- **Framework** — Next.js 14 (App Router)
- **Database** — PostgreSQL + pgvector (or SQLite for local dev)
- **ORM** — Prisma v7 with driver adapters
- **Search** — tsvector (keyword) + pgvector (semantic)
- **Embeddings** — Google Gemini
- **UI** — Tailwind CSS, Framer Motion, Lucide icons

## License

MIT
