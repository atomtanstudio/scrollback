# TODOs

## Rate limiting on /api/waitlist

**What:** Add rate limiting (e.g., 5 requests per minute per IP) to the public `/api/waitlist` POST endpoint.

**Why:** The waitlist endpoint is unauthenticated and public. Without rate limiting, bots can spam it with fake emails, polluting the waitlist data and potentially causing database growth issues.

**Context:** Flagged during the /plan-eng-review outside voice challenge (2026-03-29). The endpoint currently has no protection beyond basic email validation and deduplication. A simple in-memory rate limiter (IP-based, sliding window) would be sufficient. Consider `rate-limiter-flexible` or a lightweight custom implementation using a Map with TTL.

**Depends on:** Nothing — can be added independently before the public OSS launch.

## Pinned topics v2 for end users

**What:** Improve pinned topic management beyond the current sidebar/settings controls.

**Why:** The first pass now exposes pinned topics in the GUI, but it still needs a more polished end-user experience: better education, easier discovery, stronger auto-suggestions from capture behavior, and likely reorder/hide controls.

**Context:** Follow-up from the `Art -> pinned topic` refactor and subsequent suggested-topic work (2026-04-09). The long-term goal is for repeated capture behavior to surface obvious interests like cancer research, ADHD, etc. without making users manually manage taxonomy.

**Depends on:** Existing pinned topics API/UI. Future work should likely include reorder support, “why suggested” explanations, and stronger topic-interest heuristics.

## Thread capture mode options

**What:** Add a thread capture choice in the extension so users can choose between capturing the author’s self-thread only or the full conversation.

**Why:** Some X threads are intentionally split into self-replies for engagement, but other conversations are valuable because of the replies from multiple participants. Users should be able to choose which shape they want to save.

**Context:** Discussed on 2026-04-09 after the pinned-topic work. The likely UX is a lightweight prompt in the extension at capture time with options like `Just the author thread` and `Full conversation`.

**Depends on:** Extension capture flow updates in `extension/content.js` and likely some light server-side handling/testing for full-conversation thread assembly.
