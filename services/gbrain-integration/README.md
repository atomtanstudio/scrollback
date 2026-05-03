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

## Installed Runtime

Current installed state:

- Local Bun: `1.3.13`
- Local GBrain CLI: `gbrain 0.25.1` at `/opt/homebrew/bin/gbrain`
- Local env file: `/Users/richgates/.gbrain/gbrain.env`
- OpenClaw binary: `/home/node/.openclaw/workspace/vendor/gbrain/bin/gbrain`
- OpenClaw env file:
  `/home/node/.openclaw/workspace/.secrets/gbrain.env`
- Database: separate `gbrain` database on the existing Unraid Postgres server
- Embeddings: Legion WSL2 sidecar through `OPENAI_BASE_URL`, using 1536 dims

Do not print either env file. They contain the GBrain database password.

Local Codex command:

```sh
npm run gbrain -- doctor --json
```

OpenClaw command:

```sh
cd /home/node/.openclaw/workspace/vendor/gbrain
set -a
. /home/node/.openclaw/workspace/.secrets/gbrain.env
set +a
bin/gbrain doctor --json
```

## Runtime Requirements

GBrain itself expects:

- Bun `>=1.3.10`
- Postgres with pgvector, or GBrain's default PGLite path
- `OPENAI_API_KEY` for hybrid/vector search
- Optional `ANTHROPIC_API_KEY` for query expansion

The current FeedSilo memory gateway already provides a 1536-dimensional local
embedding surface through the Legion WSL2 sidecar. GBrain's current embedding
service is hard-coded to `text-embedding-3-large` at 1536 dimensions and uses the
OpenAI SDK. The Legion sidecar advertises `text-embedding-3-large` as an alias
for `Qwen/Qwen3-Embedding-4B`, and supports the OpenAI SDK's default `base64`
embedding response format.

Fresh-brain doctor warnings about missing embeddings, graph coverage, timeline,
or brain score are expected until markdown pages are imported.

## Checkpoint

A git checkpoint was created before this integration:

```text
7d30aac Checkpoint before GBrain integration
```

Additional checkpoints:

```text
faa8b2f Add GBrain agent skill integration
28d1bda Support GBrain embedding compatibility
```
