---
name: gbrain-memory
description: Use when the user asks for GBrain, G Brain, G memory, Garry Tan's brain, OpenClaw brain skills, persistent markdown brain memory, GBrain setup, GBrain query, or GBrain/OpenClaw skillpack routing.
---

# GBrain Memory

Use this wrapper skill to work with Garry Tan's GBrain skillpack without
installing the upstream generic skill names directly into Codex.

## Source

- Local repo: `/Users/richgates/gbrain`
- Upstream: `https://github.com/garrytan/gbrain`
- Resolver: `/Users/richgates/gbrain/skills/RESOLVER.md`
- Install guide: `/Users/richgates/gbrain/INSTALL_FOR_AGENTS.md`
- OpenClaw plugin manifest: `/Users/richgates/gbrain/openclaw.plugin.json`
- Local env file: `/Users/richgates/.gbrain/gbrain.env`

Do not print or inspect the env file. It contains the GBrain database password.

## Routing

Always read the upstream resolver before doing GBrain work:

```bash
sed -n '1,220p' /Users/richgates/gbrain/skills/RESOLVER.md
```

Then read only the specific upstream skill files that match the task. Common
routes:

- Search, lookup, "what do we know": `/Users/richgates/gbrain/skills/query/SKILL.md`
- Brain read/write rules: `/Users/richgates/gbrain/skills/brain-ops/SKILL.md`
- Setup/install: `/Users/richgates/gbrain/skills/setup/SKILL.md`
- Ingest links/articles/ideas: `/Users/richgates/gbrain/skills/idea-ingest/SKILL.md`
- Generic ingestion router: `/Users/richgates/gbrain/skills/ingest/SKILL.md`
- Maintenance and health: `/Users/richgates/gbrain/skills/maintain/SKILL.md`

## Rules

- Do not copy all upstream GBrain skills into `~/.codex/skills`; names like
  `query`, `ingest`, and `setup` can conflict with existing skills.
- Treat `/Users/richgates/gbrain` as upstream/vendor code. Make changes there
  only when explicitly working on GBrain itself.
- Before running mutating GBrain commands, verify the target database/brain repo
  and confirm whether the command writes local markdown, Postgres, or both.
- Do not print API keys or database URLs.
- If the user asks for Scrollback-captured content, use the `feedsilo-memory`
  skill first. GBrain is a separate markdown-brain system unless explicitly
  wired to imported Scrollback exports.

## Runtime

The GBrain runtime is installed locally. Prefer the Scrollback wrapper so the
database URL and local embedding endpoint are loaded without exposing secrets:

```bash
cd /Users/richgates/Documents/coding/feedsilo
npm run gbrain -- doctor --json
```

Direct local runtime:

```bash
gbrain --version
```

Expected fresh-brain warnings: no embeddings, graph coverage, timeline, or brain
score until pages are imported.

Current promoted pages:

```bash
cd /Users/richgates/Documents/coding/feedsilo
npm run gbrain -- get concepts/openclaw-memory-architecture
npm run gbrain -- get concepts/ai-business-distribution-playbook
```

OpenClaw runtime:

```bash
cd /home/node/.openclaw/workspace/vendor/gbrain
set -a
. /home/node/.openclaw/workspace/.secrets/gbrain.env
set +a
bin/gbrain doctor --json
```
