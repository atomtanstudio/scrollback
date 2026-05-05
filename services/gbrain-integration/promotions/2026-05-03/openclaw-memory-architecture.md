---
title: OpenClaw Memory Architecture
type: concept
tags:
  - openclaw
  - gbrain
  - agent-memory
  - knowledge-graphs
  - scrollback-promotion
source: scrollback
promoted_at: 2026-05-03
---

# OpenClaw Memory Architecture

OpenClaw should use a layered memory architecture: Scrollback as the raw capture
archive, GBrain as the synthesized operating brain, and a unified agent-facing
search surface that lets agents pull either raw evidence or distilled knowledge
depending on the task.

The core lesson from the captured material is that vector search alone is not
enough. Production agents need storage, recovery, proactive recall, and a graph
of relationships so they can use history instead of repeatedly asking the human
to be the router.

## Current Working Model

- Scrollback stores raw captured material: tweets, articles, threads, media,
  source URLs, summaries, and extracted text.
- The Scrollback Memory Gateway exposes that captured text directly to Codex and
  OpenClaw agents.
- GBrain stores durable synthesis: concepts, playbooks, people, companies,
  timelines, relationships, and agent-operating rules.
- The Legion embedding sidecar provides the shared 1536-dimensional embedding
  path for both Scrollback agent memory and GBrain.

This division avoids turning GBrain into a duplicate archive. Scrollback answers
"what did we save?" while GBrain answers "what do we now know?"

## Architecture Principles

1. **Raw capture and synthesized memory should stay separate.** Scrollback keeps
   the original captured text; GBrain keeps the distilled lesson with citations.

2. **Every agent should search memory before answering high-context questions.**
   OpenClaw Active Memory describes the right loop: before replying, a small
   scout checks memory and injects a short relevant summary.

3. **A resolver beats slash-command sprawl.** GBrain's resolver model uses a
   routing table that maps every turn to a skill: always-on capture, brain ops,
   ingestion, thinking, and operational routines.

4. **Relationship graphs are leverage.** Flat vectors help semantic recall, but
   shared graph memory captures actual history, relationships, frequency, and
   context across agents.

5. **The endgame is a shared memory surface.** Agents should not need to know
   whether useful context lives in Scrollback, GBrain, email, calendar, or a future
   source. They should call one surface that can search and cite all of them.

## Scrollback Evidence

- Garry Tan introduced GBrain as an MIT-licensed OpenClaw/Hermes brain that can
  give agents "total recall" over large markdown repositories.
  [Source: Scrollback item b3ee9ebe-581c-429c-9acc-7c24289afbd6,
  https://x.com/garrytan/status/2042497872114090069]

- Vox summarized the GBrain/OpenClaw pattern: `RESOLVER.md`, `SOUL.md`,
  multi-user ACLs, 24 skills, always-on sub-agent capture, and turn-by-turn
  resolver-based skill loading.
  [Source: Scrollback item b37b5210-6da6-443f-9f4a-f443b2b34d96,
  https://x.com/Voxyz_ai/status/2044346295159066971]

- OpenClaw Active Memory is the missing recall loop: storage, historical
  backfill, and proactive memory checks before every reply.
  [Source: Scrollback item 5028d46a-88dd-429c-bfb1-d87c96ec1142,
  https://x.com/Voxyz_ai/status/2042875803310899272]

- Abbie Tyrell's OpenClaw memory thread frames the production lifecycle as
  storage -> recovery -> recall. The important shift is moving from "search when
  explicitly asked" to "check memory before every reply."
  [Source: Scrollback item f126a091-876a-4d73-8bfc-1f4646bb601b,
  https://x.com/AbbieTyrell01/status/2042964926394781960]

- The Karpathy/Graphify cluster argues that agents should build persistent
  knowledge graphs instead of repeatedly re-fetching RAG chunks.
  [Source: Scrollback item dd6547ff-a2d0-4d1f-92f4-591be45a60da,
  https://x.com/jasonzhou1993/status/2045082504701575191]

- The relationship-graph thread says the real leverage is not a flat pile of
  embeddings, but a shared brain that lets agents query actual history and
  relationships.
  [Source: Scrollback item 67acdde4-7cd1-4683-9ff0-22de460de2b4,
  https://x.com/newlinedotco/status/2043719252868207093]

## Operating Rule

For OpenClaw/Judy/Codex work:

- Use Scrollback when the agent needs original captured source text.
- Use GBrain when the agent needs durable synthesized knowledge or a playbook.
- Promote only durable lessons from Scrollback into GBrain.
- Keep citations back to Scrollback item IDs and original source URLs.

---

## Timeline

- 2026-05-03: Created from Scrollback promotion search after OpenClaw snapshot and
  GBrain backup. [Source: User-directed promotion, 2026-05-03]
