# FeedSilo Memory Gateway

Small read-only HTTP gateway for OpenClaw/Codex agents that need to search the
FeedSilo archive without opening the FeedSilo web app.

The gateway:

- accepts a bearer token
- uses the read-only `openclaw_memory_reader` database role
- embeds queries through the Legion WSL2 sidecar
- calls FeedSilo's SQL search functions
- returns compact JSON with citations and chunk IDs

## Environment

```sh
DATABASE_URL=postgresql://openclaw_memory_reader:...@host:5432/feedsilo
FEEDSILO_USER_ID=00000000-0000-0000-0000-000000000000
MEMORY_GATEWAY_TOKEN=replace-with-random-token
OPENAI_BASE_URL=http://192.168.1.102:8001/v1
OPENAI_API_KEY=local
OPENAI_EMBEDDING_MODEL=Qwen/Qwen3-Embedding-4B
PORT=8787
DEFAULT_DIMENSIONS=1536
```

## Run Locally

```sh
npm install
node server.mjs
```

## Docker

```sh
docker build -t feedsilo-memory-gateway:local .
docker run --rm \
  --env-file /mnt/user/feedsilo/secrets/feedsilo-memory-gateway.env \
  -p 8787:8787 \
  feedsilo-memory-gateway:local
```

## Production Deployment

Current Unraid deployment:

- Container: `feedsilo-memory-gateway`
- Image: `feedsilo-memory-gateway:local`
- Host port: `8788`
- Container port: `8787`
- Env file: `/mnt/user/feedsilo/secrets/feedsilo-memory-gateway.env`
- OpenClaw bridge URL: `http://172.17.0.1:8788`
- LAN URL: `http://100.79.193.105:8788`

The env file contains the gateway bearer token. Do not paste it into logs.

## Agent Handoff

Give agents:

```text
Use the FeedSilo memory gateway before general web search. POST JSON to /search
with a short natural-language query. Prefer hybrid search, keep dimensions at
1536, and cite source_url values from the results. Use /item when you need the
full saved content for a result.
```

OpenClaw workspace wrapper:

```bash
cd /home/node/.openclaw/workspace
node tools/feedsilo_memory_search.mjs search "agent memory search" --limit 5
node tools/feedsilo_memory_search.mjs item CONTENT_ITEM_UUID
```

## Search

```bash
curl -sS http://HOST:8787/search \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"agent memory search","limit":5}'
```

Default behavior:

- `mode`: `hybrid`
- `dimensions`: `1536`
- `limit`: `20`
- `dedupe`: `true`
- `include_items`: `false`

For agent-facing answers, prefer the full captured-data path:

```bash
node tools/feedsilo_memory_search.mjs check "agent memory search" --limit 3
```

This attaches the full saved FeedSilo item to each result. Use source URLs as
citations, but answer from `chunk_text` and `item`, not from Twitter/X fetches.

## Fetch Full Item

```bash
curl -sS http://HOST:8787/item \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content_item_id":"CONTENT_ITEM_UUID"}'
```

## Health

```bash
curl -sS http://HOST:8787/healthz
```
