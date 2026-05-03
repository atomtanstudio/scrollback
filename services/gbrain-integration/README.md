# GBrain Integration

This directory keeps the FeedSilo-side handoff for Garry Tan's GBrain/G memory
skillpack. The upstream source of truth is:

- Local clone: `/Users/richgates/gbrain`
- GitHub: `https://github.com/garrytan/gbrain`
- Version observed at install time: `0.25.1`

## Integration Shape

GBrain ships an OpenClaw bundle manifest at `openclaw.plugin.json` and a large
skillpack under `skills/`. Many upstream skills have intentionally generic names
such as `query`, `ingest`, and `setup`, so Codex should not install those skills
unprefixed into `~/.codex/skills`.

Instead:

- Codex gets a namespaced wrapper skill: `gbrain-memory`.
- OpenClaw gets a persistent pointer to the upstream resolver and skillpack.
- Full runtime install remains a separate step because it needs Bun, a Postgres
  + pgvector database, and an embedding API key or compatible local endpoint.

## Runtime Requirements

GBrain itself expects:

- Bun `>=1.3.10`
- Postgres with pgvector, or GBrain's default PGLite path
- `OPENAI_API_KEY` for hybrid/vector search
- Optional `ANTHROPIC_API_KEY` for query expansion

The current FeedSilo memory gateway already provides a 1536-dimensional local
embedding surface through the Legion WSL2 sidecar. GBrain's current embedding
service is hard-coded to `text-embedding-3-large` at 1536 dimensions and uses the
OpenAI SDK. A local OpenAI-compatible embedding endpoint should be evaluated
before running a large GBrain embedding backfill.

## Checkpoint

A git checkpoint was created before this integration:

```text
7d30aac Checkpoint before GBrain integration
```

