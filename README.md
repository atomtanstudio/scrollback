# Scrollback

Scrollback is a self-hosted personal archive for saving X/Twitter posts, threads, linked article cards, RSS items, media, and AI art prompts into a searchable private library.

It gives you a browser-extension capture flow for X/Twitter, RSS syncing, a polished reading interface, full-text search, optional semantic search, AI enrichment, and export APIs without handing your archive to a hosted third party.

Built with Next.js 16, React 18, Prisma 7, PostgreSQL/pgvector, SQLite, Tailwind CSS, and optional OpenAI or Google Gemini AI providers.

## Features

- **One-click X/Twitter capture** - Save posts, threads, linked article metadata, images, GIFs, and videos from the browser extension.
- **RSS archive** - Add RSS or Atom feeds, sync readable entries into your library, and read them in Scrollback.
- **Hybrid search** - Combine keyword search with semantic vector search when pgvector and an AI provider are configured.
- **AI enrichment** - Optional OpenAI or Gemini summaries, tags, categories, translations, image descriptions, and embeddings.
- **Private media storage** - Store media in Cloudflare R2 or on local disk, with authenticated media proxy routes.
- **Multi-database setup** - Use SQLite for fast local installs, or PostgreSQL/Supabase for hosted installs and vector search.
- **Admin tools** - Edit, delete, reprocess, backfill media, export data, manage pinned filters, and reveal/regenerate capture tokens.
- **Remote query API** - Pull your archive into tools like Obsidian, OpenClaw, scripts, or local pipelines without exposing the database.
- **Agent memory search** - Build a chunk-level Postgres/pgvector index for OpenClaw agents, direct SQL search, and the `/agent-search` web surface.
- **Self-hosted privacy model** - No telemetry, no analytics, no central Scrollback content service.

## Current Scope

Scrollback is focused on two capture paths:

- X/Twitter capture through the Scrollback Capture browser extension.
- RSS/Atom ingestion through the web app.

It can enrich linked article cards and some long-form X article content when that data is available in the page or X API responses, but it is not meant to be a universal web clipper yet.

## Quick Start

### Requirements

- Node.js 22.x
- npm

```bash
nvm use 22
npm install
npm run doctor
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If the app is not configured yet, the onboarding wizard will guide you through database setup, admin account creation, optional AI provider setup, optional X API setup, and extension pairing.

For the fastest local evaluation, choose SQLite. For a hosted instance with semantic search, use PostgreSQL or Supabase with pgvector.

## Onboarding Flow

The onboarding wizard does the same setup work you can do manually:

1. Choose SQLite, PostgreSQL, or Supabase.
2. Write `scrollback.config.json` and managed values in `.env.local`.
3. Push the matching Prisma schema.
4. Create the first admin account.
5. Optionally choose OpenAI or Gemini, then test and save an API key.
6. Optionally save an X API bearer token.
7. Generate and save a browser-extension pairing token.

Admin account creation is required. AI provider, X API, RSS feeds, local/R2 media storage, and extension pairing can all be configured later from Settings.

## Configuration

For local development, either use onboarding or copy `.env.example` to `.env.local`.

Environment variables override values from `scrollback.config.json`.

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL/Supabase URL or SQLite file URL such as `file:./scrollback.db` |
| `DATABASE_TYPE` | Yes | `postgresql`, `supabase`, or `sqlite` |
| `AUTH_SECRET` | Yes | Auth.js session secret. Generate with `openssl rand -hex 32` |
| `EMBEDDINGS_PROVIDER` | No | Override the configured AI provider. Supported values: `openai`, `gemini` |
| `OPENAI_API_KEY` | No | Enables OpenAI embeddings, classification, summaries, translation, and image descriptions |
| `OPENAI_BASE_URL` | No | OpenAI-compatible API base URL for local/proxy embedding and model servers |
| `GEMINI_API_KEY` | No | Enables Gemini embeddings, classification, summaries, translation, and image descriptions |
| `CAPTURE_SECRET` | No | Legacy/global browser extension pairing token. Per-user tokens are generated in-app |
| `SEARCH_KEYWORD_WEIGHT` | No | Keyword search weight. Default `0.4` |
| `SEARCH_VECTOR_WEIGHT` | No | Semantic search weight. Default `0.6` |
| `R2_ACCOUNT_ID` | No | Cloudflare account ID for R2 media storage |
| `R2_ACCESS_KEY_ID` | No | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | No | R2 API token secret key |
| `R2_BUCKET_NAME` | No | R2 bucket name |
| `LOCAL_MEDIA_PATH` | No | Local directory for media storage when not using R2 |
| `XAPI_BEARER_TOKEN` | No | App-only X API bearer token for tweet lookup fallback |
| `XAPI_CLIENT_ID` | No | X OAuth 2.0 client ID for bookmark/like sync |
| `XAPI_CLIENT_SECRET` | No | X OAuth 2.0 client secret |
| `XAPI_ENCRYPTION_KEY` | No | 32-byte hex key for encrypted X OAuth token storage |
| `DEMO_EMAIL`, `DEMO_PASSWORD` | No | Creates a read-only demo user at startup |
| `WAITLIST_NOTIFY_EMAIL` | No | Enables server log notification that a waitlist signup happened |

## Production Deploy

### 1. Use Node 22

Scrollback is pinned to Node 22.x. Set your host, CI, Docker image, or runtime to Node 22 before installing dependencies.

### 2. Configure PostgreSQL

For hosted installs, PostgreSQL is recommended. Semantic search requires pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Supabase works well because pgvector is available in the dashboard. A self-managed PostgreSQL install should use a pgvector-enabled image such as `pgvector/pgvector:pg16`.

SQLite is supported for local/personal use, but it does not support vector search.

### 3. Set required environment variables

Minimum hosted configuration:

```bash
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://...
AUTH_SECRET=...
NODE_ENV=production
```

Recommended additions:

```bash
OPENAI_API_KEY=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=scrollback-media
```

### 4. Build and start

```bash
npm ci
npm run build
npm run start
```

`npm run start` applies the configured database schema, ensures users/categories, and starts Next.js. If no admin exists, open `/login` and create the first admin account.

### 5. Browser extension

Load the extension from the `extension/` directory during development. In Scrollback Settings, reveal or regenerate your capture token. Put your Scrollback server URL and capture token into the Scrollback Capture extension popup.

For local development, the server URL is usually:

```text
http://localhost:3000
```

For production, use your deployed HTTPS origin. After code changes in `extension/`, reload the unpacked extension in your browser.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run doctor` | Check Node, npm, Prisma clients, schemas, and native bindings |
| `npm run verify` | Run doctor, lint, typecheck, tests, and production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |
| `npm test` | Run Vitest tests |
| `npm run build` | Create a production build |
| `npm run start` | Run migrations/setup helpers and start production server |
| `npm run db:push` | Push the schema for the configured database |
| `npm run prisma:generate` | Generate PostgreSQL and SQLite Prisma clients |
| `npm run agent-memory:backfill` | Build the optional agent-memory chunk/vector index |
| `npm run agent-memory:search` | Search the optional agent-memory index from the CLI |
| `npm run agent-memory:gateway` | Query the optional Scrollback memory gateway helper |

## Verification Before Launch

Run this before publishing or deploying:

```bash
npm run verify
npm audit --audit-level=moderate
```

Expected result for a clean launch branch:

- doctor passes on Node 22
- lint passes
- typecheck passes
- tests pass
- production build passes
- audit reports `found 0 vulnerabilities`

## Security Notes

- Scrollback requires login for the app, settings, admin tools, media proxy routes, and user-scoped APIs.
- Extension capture uses per-user bearer tokens. Store them like passwords.
- Extension settings are stored locally in the browser.
- RSS/article HTML is sanitized before display.
- Server-side URL fetches reject local/private/reserved network targets.
- R2/local media routes check ownership before serving stored media.
- Baseline browser security headers are enabled in `next.config.mjs`.
- `.env`, `.env.local`, local databases, media folders, screenshots, worktrees, and local agent artifacts are ignored by Git.

## Remote Query API

Scrollback includes a read-only remote query endpoint for pulling content into external tools.

Use your per-user capture token:

```bash
curl -H "Authorization: Bearer YOUR_CAPTURE_TOKEN" \
  "https://your-scrollback-domain/api/remote/items?per_page=100"
```

Supported filters include:

- `id`
- `q`
- `type`
- `tag`
- `author`
- `has_prompt`
- `since`
- `until`
- `page`
- `per_page`
- `format=ndjson`

See [REMOTE_QUERY_API.md](REMOTE_QUERY_API.md) for full examples and response shapes.

## Agent Memory Search

For agent-native retrieval, Scrollback can maintain a separate chunk-level memory index beside the canonical archive. See [AGENT_MEMORY.md](AGENT_MEMORY.md) for backfill commands, direct SQL functions, read-only role grants, and the `/agent-search` interface.

## Troubleshooting

### Native binding errors

If you see errors like these:

- `Failed to load SWC binary`
- `Cannot find native binding`
- `rolldown-binding`
- `mapping process and mapped file have different Team IDs`

Use Node 22 and reinstall native dependencies:

```bash
nvm use 22
rm -rf node_modules .next
npm ci
npm run doctor
```

These errors usually happen when dependencies were installed under one Node/runtime and then executed under another, or when macOS rejects a stale native binary.

### Onboarding redirects to login

If setup was completed but no admin account exists, open `/login`. Scrollback will show the first-run admin creation form.

### AI works locally but not in production

Confirm `OPENAI_API_KEY` or `GEMINI_API_KEY` is set in your production environment and that outbound HTTPS requests to the selected provider are allowed.

### Media does not load

If using R2, verify all four R2 env vars are set. If using local media storage, verify `LOCAL_MEDIA_PATH` is writable by the app process.

## Tech Stack

- **Framework** - Next.js 16 App Router
- **Auth** - Auth.js / NextAuth v5 credentials sessions
- **Database** - PostgreSQL with pgvector, Supabase, or SQLite
- **ORM** - Prisma 7 driver adapters
- **Search** - PostgreSQL full-text search, SQLite FTS5, and optional pgvector semantic search
- **AI** - OpenAI or Google Gemini embeddings and enrichment
- **Media** - Cloudflare R2 or authenticated local media storage
- **UI** - Tailwind CSS, Framer Motion, Lucide icons
- **Testing** - Vitest

## License

MIT
