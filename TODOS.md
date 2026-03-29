# TODOs

## Rate limiting on /api/waitlist

**What:** Add rate limiting (e.g., 5 requests per minute per IP) to the public `/api/waitlist` POST endpoint.

**Why:** The waitlist endpoint is unauthenticated and public. Without rate limiting, bots can spam it with fake emails, polluting the waitlist data and potentially causing database growth issues.

**Context:** Flagged during the /plan-eng-review outside voice challenge (2026-03-29). The endpoint currently has no protection beyond basic email validation and deduplication. A simple in-memory rate limiter (IP-based, sliding window) would be sufficient. Consider `rate-limiter-flexible` or a lightweight custom implementation using a Map with TTL.

**Depends on:** Nothing — can be added independently before the public OSS launch.
