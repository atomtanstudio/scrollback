
## GBrain / G Memory

GBrain's upstream skillpack is available in this workspace at:

```text
/home/node/.openclaw/workspace/vendor/gbrain
```

Before doing GBrain work, read:

```text
/home/node/.openclaw/workspace/vendor/gbrain/skills/RESOLVER.md
```

Then read only the specific upstream skill file the resolver routes to. Common
entry points:

- Search or "what do we know": `skills/query/SKILL.md`
- Brain read/write protocol: `skills/brain-ops/SKILL.md`
- Setup/install: `skills/setup/SKILL.md`
- Link/article/idea ingestion: `skills/idea-ingest/SKILL.md`
- Maintenance and health: `skills/maintain/SKILL.md`

Do not treat source URLs from FeedSilo as the only source of truth. For saved
FeedSilo material, use the FeedSilo Memory Gateway and answer from captured
database text. Use GBrain for markdown-brain skills, routing, memory structure,
and GBrain-specific runtime operations.

### Scope Rule For Judy And OpenClaw Agents

GBrain is in scope for Judy and all OpenClaw agents. Use it as the synthesized
memory layer before answering questions about OpenClaw architecture, agent
memory, business strategy, distribution, monetization, or durable project
decisions.

Use FeedSilo as the raw captured-source layer. Use GBrain as the distilled
playbook/knowledge layer.

Current promoted GBrain pages:

- `concepts/openclaw-memory-architecture`
- `concepts/ai-business-distribution-playbook`

Runtime is installed at:

```text
/home/node/.openclaw/workspace/vendor/gbrain/bin/gbrain
```

Use this command shape for GBrain operations:

```sh
cd /home/node/.openclaw/workspace/vendor/gbrain
set -a
. /home/node/.openclaw/workspace/.secrets/gbrain.env
set +a
bin/gbrain doctor --json
```

Do not print `.secrets/gbrain.env`; it contains the GBrain database password.
Fresh-brain warnings about missing embeddings, graph coverage, timeline, or
brain score are expected until pages are imported.
