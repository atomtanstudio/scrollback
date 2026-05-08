# Hacker News

## Title

Show HN: Scrollback - self-hosted archive for X, RSS, articles, and AI search

## URL

https://github.com/atomtanstudio/scrollback

## First Comment

Hi HN, I built Scrollback because my saved posts, RSS feeds, article links, media, and prompts kept ending up in separate places that were hard to search later.

Scrollback is a self-hosted archive with:

- X/Twitter post, thread, media, and linked article capture through a browser extension
- RSS/Atom ingestion
- SQLite onboarding for local installs
- PostgreSQL/Supabase support for hosted installs
- full-text search and optional pgvector semantic search
- optional OpenAI/Gemini enrichment for summaries, tags, categories, translations, image descriptions, and embeddings
- export and read-only remote query APIs

There is a public read-only demo here:

https://scrollback.atomtan.studio

The current scope is deliberately narrow: X/Twitter capture and RSS/Atom ingestion. It is not a universal web clipper yet.

One safety note: one-click X capture can work without the X API, but for bulk importing Likes and Bookmarks I recommend using the official X API bearer token or OAuth path. That is more reliable and lower risk than page-based scraping.

I would especially appreciate feedback on the self-hosting setup, the README/onboarding flow, and whether the remote query/API shape is useful for local tools and agents.
