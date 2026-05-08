# Reddit

Use the established personal account. Do not cross-post identical text everywhere at the same minute. Pick 1-2 subreddits for the first wave, then wait and respond.

## r/selfhosted

Title:

I built Scrollback, a self-hosted archive for X/Twitter saves, RSS feeds, articles, and search

Body:

I built Scrollback because my saved posts, threads, RSS reads, article links, and prompts were scattered across too many places and were hard to search later.

Scrollback is a self-hosted archive you can run yourself. It currently focuses on:

- X/Twitter post, thread, media, and linked article capture through a browser extension
- RSS/Atom feed ingestion
- SQLite for local setup
- PostgreSQL/Supabase for hosted installs
- full-text search and optional semantic search with pgvector
- optional OpenAI/Gemini enrichment for summaries, tags, categories, translations, image descriptions, and embeddings
- export and read-only remote query APIs

Demo:

https://scrollback.atomtan.studio

GitHub:

https://github.com/atomtanstudio/scrollback

One note on X/Twitter capture: one-click saves can work without the X API, but I recommend the official X API bearer token or OAuth flow for bulk importing Likes and Bookmarks. It is more reliable and lower risk than page-based scraping.

I would love feedback from other self-hosters on the setup flow, docs, and whether the deployment assumptions make sense.

## r/opensource

Title:

Scrollback: open-source self-hosted archive for X/Twitter, RSS, articles, and AI-searchable saves

Body:

I’m releasing Scrollback, an open-source self-hosted archive for the things people save from X/Twitter, RSS feeds, article links, media, and prompts.

The goal is to keep a personal research/archive library on your own infrastructure, with search and optional AI enrichment, instead of relying on another hosted read-it-later inbox.

Current features:

- browser extension capture for X/Twitter posts, threads, media, and article cards
- RSS/Atom ingestion
- SQLite onboarding for local installs
- PostgreSQL/Supabase support for hosted installs
- full-text search and optional pgvector semantic search
- optional OpenAI/Gemini enrichment
- exports and read-only remote query APIs

Demo:

https://scrollback.atomtan.studio

Repo:

https://github.com/atomtanstudio/scrollback

I’m especially interested in feedback on the README, onboarding flow, security assumptions, and whether the project boundaries are clear enough for a first public release.

## r/DataHoarder

Title:

I built a self-hosted archive for saved posts, RSS feeds, articles, media, and prompts

Body:

I built Scrollback as a self-hosted archive for the internet things I keep saving and then losing: X/Twitter posts and threads, RSS items, linked articles, media, and prompts.

It is not trying to replace a full web archiver yet. The current release is focused on making saved/social/feed material searchable and exportable from a system you control.

Useful bits for this community:

- local SQLite setup for evaluation
- PostgreSQL/Supabase for hosted installs
- media storage on local disk or Cloudflare R2
- export API and read-only remote query API
- full-text search and optional semantic search
- no central Scrollback content service

Demo:

https://scrollback.atomtan.studio

GitHub:

https://github.com/atomtanstudio/scrollback

I’d be interested in feedback on export formats, media storage assumptions, and what would make it more useful as a personal archive.

## r/rss

Title:

I built Scrollback, a self-hosted RSS + saved-post archive with search

Body:

I built Scrollback as a self-hosted archive for RSS feeds plus saved X/Twitter posts, threads, article cards, media, and prompts.

For RSS, it can add RSS/Atom sources, sync entries into the same searchable archive as other saves, and keep them available alongside captured posts and linked articles.

The larger goal is a personal archive where feeds, saved posts, and article links live in one searchable place.

Demo:

https://scrollback.atomtan.studio

GitHub:

https://github.com/atomtanstudio/scrollback

I’d especially appreciate feedback from RSS users on feed-management expectations and what would make the RSS side more useful.
