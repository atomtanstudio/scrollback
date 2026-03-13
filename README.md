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

Copy `.env.example` to `.env.local` and fill in your values, or use the onboarding wizard which writes it for you.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DATABASE_TYPE` | Yes | `postgresql`, `supabase`, or `sqlite` |
| `GEMINI_API_KEY` | No | Google Gemini API key for embeddings |
| `CAPTURE_SECRET` | No | Browser extension pairing token |
| `SEARCH_KEYWORD_WEIGHT` | No | Keyword search weight (default: `0.4`) |
| `SEARCH_VECTOR_WEIGHT` | No | Semantic search weight (default: `0.6`) |

## Deploy (Dokploy / Nixpacks)

1. Push repo to GitHub (private or public)
2. Create a PostgreSQL database with the `vector` extension enabled
3. In Dokploy, connect the repo and set environment variables:
   - `DATABASE_URL` — your PostgreSQL connection string
   - `DATABASE_TYPE` — `postgresql`
   - `GEMINI_API_KEY` — (optional) for semantic search
   - `CAPTURE_SECRET` — (optional) for browser extension
4. Set the **start command** to: `npm run db:push && npm run start`
5. Deploy — the app skips onboarding when env vars are set

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
