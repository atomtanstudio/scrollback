---
name: feedsilo-memory
description: Use when the user asks to check, search, look in, query, or consult FeedSilo, Feed Silo, saved captures, saved articles, saved tweets, captured prompts, the personal archive, or prior captured research. This skill searches the FeedSilo memory gateway and can fetch full saved items by content_item_id.
---

# FeedSilo Memory

Use the FeedSilo memory gateway before general web search when the user asks
about saved or captured material.

## Search

Run from any workspace:

```bash
cd /Users/richgates/Documents/coding/feedsilo
npm run agent-memory:gateway -- check "QUERY" --limit 3
```

Default search is hybrid retrieval over 1536-dimensional FeedSilo vectors. The
`check` command returns both matched chunks and full saved FeedSilo items.

Use this command for normal user requests like "check FeedSilo for this." Use
`search` only when you need lighter output or more candidates.

## Fetch Full Item

When a result matters, fetch the full saved item before summarizing or quoting it:

```bash
cd /Users/richgates/Documents/coding/feedsilo
npm run agent-memory:gateway -- item CONTENT_ITEM_UUID
```

## Response Rules

- Cite `source_url` or `citation_url` values from results.
- Answer from captured `chunk_text` and `item` data, not from Twitter/X fetches.
- Do not give only source links. Links are citations and follow-up references,
  while the saved database text is the source the agent can read.
- Prefer concise summaries of the saved material.
- Do not print or inspect `~/.codex/secrets/feedsilo-memory-gateway.env`.
- If search fails because the gateway is unreachable, run:

```bash
cd /Users/richgates/Documents/coding/feedsilo
npm run agent-memory:gateway -- health
```

Then report the health result and likely dependency: Unraid gateway
`100.79.193.105:8788` or Legion embedding sidecar `192.168.1.102:8001`.
