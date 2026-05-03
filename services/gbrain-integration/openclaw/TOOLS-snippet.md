
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

The GBrain CLI/runtime may not be installed inside the container yet. If
`gbrain --version` fails, use the skillpack docs only and report that the runtime
install is still pending.

