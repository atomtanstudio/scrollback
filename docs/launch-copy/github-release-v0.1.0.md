# v0.1.0 - Scrollback

Scrollback is a self-hosted archive for X/Twitter saves, RSS feeds, articles, media, prompts, and AI-searchable research trails.

This first public release includes:

- X/Twitter post, thread, media, and linked article capture through the browser extension
- RSS/Atom feed ingestion
- A polished private reading/search interface
- Keyword search, optional semantic search, and optional AI enrichment
- SQLite onboarding for local installs
- PostgreSQL/Supabase support for hosted installs and vector search
- Export and read-only remote query APIs
- Optional agent-memory search for chunk-level retrieval
- A public read-only demo at `https://scrollback.atomtan.studio`

## Quick Start

```bash
nvm use 22
npm install
npm run doctor
npm run dev
```

Open `http://localhost:3000` and follow onboarding. Choose SQLite for the fastest local evaluation.

## X API Safety Note

The browser extension can capture visible X/Twitter pages without an X API token for normal one-click saves. For bulk imports, especially Likes and Bookmarks, the official X API bearer token or OAuth flow is strongly recommended because it is more reliable and lower risk than page-based scraping.

## Known Limitations

- Scrollback is not a universal web clipper yet.
- X/Twitter capture depends on X web surfaces and can require extension updates when X changes markup.
- SQLite is best for local evaluation and personal archives; semantic vector search requires PostgreSQL/Supabase with pgvector.
- The demo site is read-only and uses demo data.

## Links

- Demo: `https://scrollback.atomtan.studio`
- Trailer: `https://scrollback.atomtan.studio/launch/scrollback-launch-trailer.mp4`
- README: `https://github.com/atomtanstudio/scrollback#readme`
