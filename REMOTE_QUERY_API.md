# Remote Query API

FeedSilo exposes a read-only remote query API for exporting your saved items into tools like Obsidian, OpenClaw, scripts, or local pipelines.

This API is designed to be:

- read-only
- scoped to the authenticated user
- safer than exposing PostgreSQL directly
- usable with a per-user capture token

## Base URL

Production:

```bash
https://your-feedsilo-domain/api/remote/items
```

Local example:

```bash
http://127.0.0.1:3000/api/remote/items
```

## Authentication

Use your FeedSilo capture token as a Bearer token.

```bash
curl -H "Authorization: Bearer YOUR_CAPTURE_TOKEN" \
  "https://your-feedsilo-domain/api/remote/items?per_page=10"
```

You can reveal or regenerate the token from FeedSilo settings.

If you are already logged into FeedSilo in the browser, the route also accepts your session automatically for browser-based usage.

## What It Returns

Each item can include:

- core item metadata
- original source URLs
- author info
- AI summary
- translated title/body
- prompt fields
- tags
- categories
- media records with display URLs
- engagement stats where available

## Query Parameters

### Pagination

- `page`
  - default: `1`
- `per_page`
  - default: `100`
  - max: `1000`

### Filters

- `id`
  - fetch a specific item by FeedSilo item ID
- `q`
  - case-insensitive search across:
    - `title`
    - `body_text`
    - `translated_title`
    - `translated_body_text`
    - `ai_summary`
- `type`
  - supported values:
    - `tweet`
    - `thread`
    - `article`
    - `rss`
    - `art`
  - `art` maps to prompt/media-oriented content types
- `tag`
  - matches either a tag slug or a category slug
- `author`
  - case-insensitive match against:
    - `author_handle`
    - `author_display_name`
- `has_prompt`
  - `true`, `false`, `1`, or `0`
- `since`
  - ISO-8601 lower bound for `created_at`
- `until`
  - ISO-8601 upper bound for `created_at`
- `format`
  - omit for standard JSON
  - set to `ndjson` for newline-delimited JSON

## Response Formats

### Standard JSON

Default response:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "per_page": 100,
  "has_more": false,
  "auth_method": "token",
  "filters": {
    "id": null,
    "q": null,
    "type": null,
    "tag": null,
    "author": null,
    "has_prompt": null,
    "since": null,
    "until": null
  }
}
```

### NDJSON

Use NDJSON when you want to stream items line-by-line into another tool:

```bash
curl -H "Authorization: Bearer YOUR_CAPTURE_TOKEN" \
  "https://your-feedsilo-domain/api/remote/items?format=ndjson&per_page=100"
```

Each line is one JSON object.

## Example Queries

### 1. Pull the latest 100 items

```bash
curl -H "Authorization: Bearer YOUR_CAPTURE_TOKEN" \
  "https://your-feedsilo-domain/api/remote/items?per_page=100"
```

### 2. Pull only art-related items

```bash
curl -H "Authorization: Bearer YOUR_CAPTURE_TOKEN" \
  "https://your-feedsilo-domain/api/remote/items?type=art&per_page=100"
```

### 3. Pull items by tag or category slug

```bash
curl -H "Authorization: Bearer YOUR_CAPTURE_TOKEN" \
  "https://your-feedsilo-domain/api/remote/items?tag=performance-optimization"
```

### 4. Search by text

```bash
curl -H "Authorization: Bearer YOUR_CAPTURE_TOKEN" \
  "https://your-feedsilo-domain/api/remote/items?q=vector%20search"
```

### 5. Pull content from a given author

```bash
curl -H "Authorization: Bearer YOUR_CAPTURE_TOKEN" \
  "https://your-feedsilo-domain/api/remote/items?author=karpathy"
```

### 6. Pull only items with prompts

```bash
curl -H "Authorization: Bearer YOUR_CAPTURE_TOKEN" \
  "https://your-feedsilo-domain/api/remote/items?has_prompt=true"
```

### 7. Pull items created in a date range

```bash
curl -H "Authorization: Bearer YOUR_CAPTURE_TOKEN" \
  "https://your-feedsilo-domain/api/remote/items?since=2026-01-01T00:00:00Z&until=2026-04-01T00:00:00Z"
```

### 8. Fetch a single item by ID

```bash
curl -H "Authorization: Bearer YOUR_CAPTURE_TOKEN" \
  "https://your-feedsilo-domain/api/remote/items?id=YOUR_ITEM_ID"
```

### 9. Stream NDJSON into a file

```bash
curl -H "Authorization: Bearer YOUR_CAPTURE_TOKEN" \
  "https://your-feedsilo-domain/api/remote/items?format=ndjson&per_page=500" \
  > feedsilo-export.ndjson
```

## Useful Fields Per Item

Typical fields include:

- `id`
- `source_type`
- `source_platform`
- `external_id`
- `conversation_id`
- `title`
- `body_text`
- `translated_title`
- `translated_body_text`
- `ai_summary`
- `author_handle`
- `author_display_name`
- `author_avatar_url`
- `original_url`
- `posted_at`
- `created_at`
- `updated_at`
- `language`
- `has_prompt`
- `prompt_type`
- `prompt_text`
- `likes`
- `retweets`
- `replies`
- `views`
- `tags`
- `categories`
- `media`

## Media Shape

Each media item includes fields like:

- `id`
- `type`
- `original_url`
- `stored_path`
- `display_url`
- `alt_text`
- `ai_description`
- `position_in_content`
- `width`
- `height`
- `file_size_bytes`

`display_url` is the preferred field for downstream consumers because it resolves to the best available public-facing media URL.

## Notes for OpenClaw or Obsidian

- Use `format=ndjson` if your importer prefers one JSON object per line.
- Use `per_page=1000` for fewer requests when doing larger syncs.
- Use `since` with a remembered timestamp for incremental sync.
- Prefer `display_url` over `original_url` for media rendering.
- Tags and categories are separate arrays; both may be useful for knowledge graph ingestion.

## Error Behavior

If the token is missing or invalid:

```json
{
  "error": "Unauthorized"
}
```

HTTP status:

```text
401
```

## Security Model

- The endpoint is read-only.
- Results are always scoped to the authenticated user.
- It does not expose raw database access.
- It supports either session auth or Bearer token auth.
