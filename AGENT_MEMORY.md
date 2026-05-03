# Agent Memory Search

FeedSilo can expose its captured archive as a direct PostgreSQL/pgvector memory index for OpenClaw agents and local tools.

This layer is separate from the normal FeedSilo feed UI:

- `content_items` remains the canonical captured archive.
- `agent_memory_chunks` stores chunked passages optimized for retrieval.
- `agent_memory_embeddings` stores 768- or 1536-dimension vectors per chunk.
- SQL functions expose read-oriented keyword, vector, and hybrid search.
- `/agent-search` is a lightweight web front end over the same search path.

## Backfill

Create chunks and 768-dimension embeddings:

```bash
npm run agent-memory:backfill -- --user-email you@example.com
```

Create chunks only:

```bash
npm run agent-memory:backfill -- --user-email you@example.com --chunks-only
```

Build a 1536-dimension side index:

```bash
npm run agent-memory:backfill -- --user-email you@example.com --dimensions 1536
```

Use `--limit` to process the archive in passes:

```bash
npm run agent-memory:backfill -- --user-email you@example.com --limit 1000
```

## Direct SQL Search

OpenClaw can connect to Postgres with a read-only role and call these functions directly.

Keyword:

```sql
select *
from agent_memory_keyword_search(
  'USER_UUID'::uuid,
  'agent orchestration',
  20
);
```

Vector, 768 dimensions:

```sql
select *
from agent_memory_vector_search_768(
  'USER_UUID'::uuid,
  '[0.01,0.02,...]'::vector,
  20
);
```

Hybrid, 768 dimensions:

```sql
select *
from agent_memory_hybrid_search_768(
  'USER_UUID'::uuid,
  'agent orchestration',
  '[0.01,0.02,...]'::vector,
  20,
  0.45,
  0.55
);
```

1536-dimension equivalents are also available:

- `agent_memory_vector_search_1536`
- `agent_memory_hybrid_search_1536`

## Read-Only Agent Role

Recommended grant shape:

```sql
create role openclaw_memory_reader login password 'replace-this';

grant usage on schema public to openclaw_memory_reader;
grant select on agent_memory_documents to openclaw_memory_reader;
grant execute on function agent_memory_keyword_search(uuid, text, integer) to openclaw_memory_reader;
grant execute on function agent_memory_vector_search_768(uuid, vector, integer) to openclaw_memory_reader;
grant execute on function agent_memory_vector_search_1536(uuid, vector, integer) to openclaw_memory_reader;
grant execute on function agent_memory_hybrid_search_768(uuid, text, vector, integer, double precision, double precision) to openclaw_memory_reader;
grant execute on function agent_memory_hybrid_search_1536(uuid, text, vector, integer, double precision, double precision) to openclaw_memory_reader;
```

Do not give agents the main FeedSilo application database credentials.

## HTTP Search

The API wrapper accepts a logged-in session or per-user capture token:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CAPTURE_TOKEN" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3000/api/agent/search \
  -d '{"query":"agent orchestration","mode":"hybrid","dimensions":768,"limit":20}'
```

Use `/agent-search` for the browser search surface.
