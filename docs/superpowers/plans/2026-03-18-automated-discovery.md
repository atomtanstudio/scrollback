# Automated Content Discovery Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated content discovery system that pulls relevant tweets from the X API based on user-configured sources, budgets, and interest areas, presenting results in a separate discovery inbox.

**Architecture:** Independent discovery source modules composed by a thin orchestrator, backed by Prisma models for job tracking and cost control. Scheduled via external cron (midnight/noon) and on-demand via API. Single-user first, multi-user ready.

**Tech Stack:** Next.js 14 App Router, Prisma v7 (PostgreSQL), X API v2 (pay-per-use), Gemini embeddings (768-dim), Tailwind CSS, shadcn/ui, vitest

**Spec:** `docs/superpowers/specs/2026-03-18-automated-discovery-design.md`

---

## File Structure

### New Files
```
lib/discovery/
  types.ts              — Shared types, interfaces, cost constants
  sources/
    following.ts        — Fetch user's following list, cache in DB
    timeline.ts         — Fetch tweets from user IDs with high-water marks
    second-degree.ts    — 2nd-degree following expansion
    search.ts           — Keyword/topic X API search
  relevance.ts          — Score tweets against user config
  feedback.ts           — Negative signal from irrelevant flags
  orchestrator.ts       — Compose sources, deduplicate, score, persist
  cost.ts               — X API endpoint cost map, budget tracking

app/api/discovery/
  run/route.ts          — POST: trigger on-demand run
  cron/route.ts         — POST: scheduled run endpoint
  inbox/route.ts        — GET: list discovery items; PATCH: save/dismiss/flag
  history/route.ts      — GET: recent run history

app/discovery/
  page.tsx              — Discovery inbox page (server component shell)

components/discovery/
  discovery-page.tsx    — Main discovery inbox client component
  discovery-card.tsx    — Tweet card with save/dismiss/flag actions
  run-history.tsx       — Recent runs display
  run-trigger.tsx       — On-demand run button with status

components/settings/sections/
  discovery-section.tsx — Discovery config in settings (scheduled + on-demand tabs)

app/api/settings/
  discovery/route.ts  — GET/PUT: discovery config per mode

__tests__/
  discovery/
    relevance.test.ts   — Relevance scoring unit tests
    feedback.test.ts    — Feedback penalty unit tests
    orchestrator.test.ts — Orchestrator logic tests
    cost.test.ts        — Cost tracking tests
    timeline.test.ts    — Timeline source unit tests
    search.test.ts      — Search source unit tests
```

### Modified Files
```
prisma/schema.prisma         — Add 4 new models + 2 enums + User relations
lib/xapi/client.ts           — Add fetchFollowing(), fetchUserTimeline(), searchTweets()
lib/xapi/mapper.ts           — Export mapTweetToPayload for discovery reuse
components/settings/settings-page.tsx — Add DiscoverySection import
components/header.tsx         — Add /discovery nav link
middleware.ts                 — Protect /api/discovery/cron with secret
```

---

## Chunk 1: Data Model & Types

### Task 1: Define Discovery Types

**Files:**
- Create: `lib/discovery/types.ts`

- [ ] **Step 1: Create the shared types file**

```typescript
// lib/discovery/types.ts

/** Which source tiers are available */
export type DiscoverySource = "following" | "second_degree" | "search";

/** Config mode — scheduled runs vs on-demand */
export type DiscoveryMode = "scheduled" | "on_demand";

/** Status of a discovery run */
export type DiscoveryRunStatus = "pending" | "running" | "completed" | "failed";

/** Status of an inbox item */
export type DiscoveryItemStatus = "pending" | "saved" | "dismissed" | "irrelevant";

/** Result from a single source module */
export interface SourceResult {
  tweets: DiscoveredTweet[];
  costCents: number;
}

/** A tweet discovered by a source module, before scoring */
export interface DiscoveredTweet {
  tweetId: string;
  authorId: string;
  authorHandle: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  text: string;
  noteText: string | null;
  createdAt: string | null;
  conversationId: string | null;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    views: number;
  };
  mediaUrls: string[];
  rawJson: Record<string, unknown>;
}

/** A scored tweet ready for the inbox */
export interface ScoredTweet extends DiscoveredTweet {
  relevanceScore: number;
  matchReasons: string[];
}

/** Config passed to each source module */
export interface SourceConfig {
  userId: string;
  enabledSources: DiscoverySource[];
  categories: string[];
  keywords: string[];
  budgetCents: number;
  secondDegreeSampleSize: number;
  semanticMatchThreshold: number;
}

/** Budget tracker passed between modules */
export interface BudgetTracker {
  totalBudgetCents: number;
  readonly spentCents: number;
  remaining(): number;
  spend(cents: number): void;
  isExhausted(): boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/discovery/types.ts
git commit -m "feat(discovery): add shared types and interfaces"
```

### Task 2: Define X API Cost Constants

**Files:**
- Create: `lib/discovery/cost.ts`
- Create: `__tests__/discovery/cost.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/discovery/cost.test.ts
import { describe, it, expect } from "vitest";
import { createBudgetTracker, getEndpointCost } from "@/lib/discovery/cost";

describe("BudgetTracker", () => {
  it("tracks spending and remaining budget", () => {
    const tracker = createBudgetTracker(100);
    expect(tracker.remaining()).toBe(100);

    tracker.spend(30);
    expect(tracker.remaining()).toBe(70);
    expect(tracker.spentCents).toBe(30);
    expect(tracker.isExhausted()).toBe(false);
  });

  it("reports exhausted when budget is zero", () => {
    const tracker = createBudgetTracker(10);
    tracker.spend(10);
    expect(tracker.isExhausted()).toBe(true);
    expect(tracker.remaining()).toBe(0);
  });

  it("does not go negative", () => {
    const tracker = createBudgetTracker(5);
    tracker.spend(10);
    expect(tracker.remaining()).toBe(0);
    expect(tracker.spentCents).toBe(10);
  });
});

describe("getEndpointCost", () => {
  it("returns known costs for X API endpoints", () => {
    expect(getEndpointCost("search_recent")).toBeGreaterThan(0);
    expect(getEndpointCost("user_timeline")).toBeGreaterThan(0);
    expect(getEndpointCost("following_list")).toBeGreaterThan(0);
  });

  it("throws for unknown endpoints", () => {
    expect(() => getEndpointCost("unknown_endpoint")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/discovery/cost.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Write implementation**

```typescript
// lib/discovery/cost.ts
import type { BudgetTracker } from "./types";

/**
 * X API v2 pay-per-use costs in cents per request.
 * Source: https://developer.x.com/en/docs/twitter-api/rate-limits
 * These are approximate and should be updated as X changes pricing.
 */
const ENDPOINT_COSTS: Record<string, number> = {
  search_recent: 1,        // GET /2/tweets/search/recent
  user_timeline: 1,        // GET /2/users/:id/tweets
  following_list: 1,       // GET /2/users/:id/following
  tweets_lookup: 1,        // GET /2/tweets?ids=
  user_lookup: 1,          // GET /2/users/by/username
};

export function getEndpointCost(endpoint: string): number {
  const cost = ENDPOINT_COSTS[endpoint];
  if (cost === undefined) {
    throw new Error(`Unknown X API endpoint: ${endpoint}`);
  }
  return cost;
}

export function createBudgetTracker(totalBudgetCents: number): BudgetTracker {
  let spentCents = 0;

  return {
    totalBudgetCents,
    get spentCents() {
      return spentCents;
    },
    remaining() {
      return Math.max(0, totalBudgetCents - spentCents);
    },
    spend(cents: number) {
      spentCents += cents;
    },
    isExhausted() {
      return spentCents >= totalBudgetCents;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/discovery/cost.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/cost.ts __tests__/discovery/cost.test.ts
git commit -m "feat(discovery): add cost tracking and budget tracker"
```

### Task 3: Add Prisma Schema Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums to schema**

Add after existing enums in `prisma/schema.prisma`:

```prisma
enum DiscoveryMode {
  scheduled
  on_demand
}

enum DiscoveryRunStatus {
  pending
  running
  completed
  failed
}

enum DiscoveryItemStatus {
  pending
  saved
  dismissed
  irrelevant
}
```

- [ ] **Step 2: Add DiscoveryConfig model**

```prisma
model DiscoveryConfig {
  id                       String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id                  String          @db.Uuid
  mode                     DiscoveryMode
  enabled_sources          String[]        // ["following", "second_degree", "search"]
  categories               String[]        // category slugs
  keywords                 String[]
  budget_cents             Int             @default(100)
  second_degree_sample_size Int            @default(10)
  semantic_match_threshold  Float          @default(0.4)
  created_at               DateTime        @default(now())
  updated_at               DateTime        @updatedAt

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, mode])
  @@map("discovery_configs")
}
```

- [ ] **Step 3: Add DiscoveryRun model**

```prisma
model DiscoveryRun {
  id                 String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id            String             @db.Uuid
  mode               DiscoveryMode
  status             DiscoveryRunStatus @default(pending)
  started_at         DateTime?
  completed_at       DateTime?
  api_cost_cents     Int                @default(0)
  tweets_found       Int                @default(0)
  tweets_saved       Int                @default(0)
  duplicates_skipped Int                @default(0)
  error_message      String?
  created_at         DateTime           @default(now())

  user            User            @relation(fields: [user_id], references: [id], onDelete: Cascade)
  discovery_items DiscoveryItem[]

  @@map("discovery_runs")
}
```

- [ ] **Step 4: Add DiscoveryItem model**

```prisma
model DiscoveryItem {
  id              String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id         String              @db.Uuid
  run_id          String              @db.Uuid
  tweet_id        String
  relevance_score Float
  match_reasons   String[]
  status          DiscoveryItemStatus @default(pending)
  raw_data        Json
  created_at      DateTime            @default(now())

  user User         @relation(fields: [user_id], references: [id], onDelete: Cascade)
  run  DiscoveryRun @relation(fields: [run_id], references: [id], onDelete: Cascade)

  @@unique([user_id, tweet_id])
  @@index([user_id, status])
  @@map("discovery_items")
}
```

- [ ] **Step 5: Add HighWaterMark model**

```prisma
model HighWaterMark {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id         String   @db.Uuid
  source_user_id  String
  last_tweet_id   String
  miss_count      Int      @default(0)
  updated_at      DateTime @updatedAt

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, source_user_id])
  @@map("high_water_marks")
}
```

- [ ] **Step 6: Add relations to User model**

Add to the existing `User` model:

```prisma
  discovery_configs DiscoveryConfig[]
  discovery_runs    DiscoveryRun[]
  discovery_items   DiscoveryItem[]
  high_water_marks  HighWaterMark[]
```

- [ ] **Step 7: Run Prisma migration**

```bash
npx prisma migrate dev --name add_discovery_models
```

Expected: Migration applies successfully, new tables created.

- [ ] **Step 8: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: Client regenerated with new models.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ lib/generated/
git commit -m "feat(discovery): add Prisma schema for discovery models"
```

---

## Chunk 2: X API Client Extensions

### Task 4: Add Discovery X API Methods

**Files:**
- Modify: `lib/xapi/client.ts`

The existing client has `fetchBookmarks`, `fetchLikedTweets`, `fetchTweetsByIds`, and `fetchMe`. We need to add `fetchFollowing`, `fetchUserTimeline`, and `searchRecentTweets`.

- [ ] **Step 1: Add fetchFollowing to client.ts**

Add after the existing `fetchMe` function:

```typescript
/**
 * Fetch users that a given user follows.
 * Requires user OAuth token.
 * Returns up to max_results users per page (max 1000).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchFollowing(
  userId: string,
  paginationToken?: string,
  maxResults: number = 1000
): Promise<any> {
  const params: Record<string, string> = {
    "user.fields": USER_FIELDS,
    max_results: String(Math.min(maxResults, 1000)),
  };
  if (paginationToken) params.pagination_token = paginationToken;

  return xApiFetch(`/users/${userId}/following`, params);
}
```

- [ ] **Step 2: Add fetchUserTimeline to client.ts**

```typescript
/**
 * Fetch recent tweets from a specific user's timeline.
 * Requires user OAuth token.
 * Supports since_id for incremental fetching.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchUserTimeline(
  userId: string,
  opts?: { sinceId?: string; paginationToken?: string; maxResults?: number }
): Promise<any> {
  const params: Record<string, string> = {
    "tweet.fields": TWEET_FIELDS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
    expansions: EXPANSIONS,
    max_results: String(opts?.maxResults ?? 100),
    exclude: "retweets",
  };
  if (opts?.sinceId) params.since_id = opts.sinceId;
  if (opts?.paginationToken) params.pagination_token = opts.paginationToken;

  return xApiFetch(`/users/${userId}/tweets`, params);
}
```

- [ ] **Step 3: Add searchRecentTweets to client.ts**

```typescript
/**
 * Search recent tweets by query string.
 * Uses app-level bearer token (no OAuth needed).
 * Max 100 results per page.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function searchRecentTweets(
  query: string,
  opts?: { sinceId?: string; paginationToken?: string; maxResults?: number }
): Promise<any> {
  const bearerToken = process.env.XAPI_BEARER_TOKEN || getConfig()?.xapi?.bearerToken;
  if (!bearerToken) throw new Error("XAPI_BEARER_TOKEN not configured");

  const url = new URL(`${BASE_URL}/tweets/search/recent`);
  url.searchParams.set("query", query);
  url.searchParams.set("tweet.fields", TWEET_FIELDS);
  url.searchParams.set("user.fields", USER_FIELDS);
  url.searchParams.set("media.fields", MEDIA_FIELDS);
  url.searchParams.set("expansions", EXPANSIONS);
  url.searchParams.set("max_results", String(opts?.maxResults ?? 100));
  if (opts?.sinceId) url.searchParams.set("since_id", opts.sinceId);
  if (opts?.paginationToken) url.searchParams.set("next_token", opts.paginationToken);

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`X API search error: ${resp.status} ${text}`);
  }

  return resp.json();
}
```

- [ ] **Step 4: Add rate limit header parsing utility**

Add at the top of client.ts, after imports:

```typescript
export interface RateLimitInfo {
  remaining: number;
  resetAt: Date;
}

export function parseRateLimitHeaders(headers: Headers): RateLimitInfo | null {
  const remaining = headers.get("x-rate-limit-remaining");
  const reset = headers.get("x-rate-limit-reset");
  if (!remaining || !reset) return null;
  return {
    remaining: parseInt(remaining, 10),
    resetAt: new Date(parseInt(reset, 10) * 1000),
  };
}
```

Update the existing `xApiFetch` to handle 429 rate limits with retry (max 3 retries):

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function xApiFetch(path: string, params?: Record<string, string>): Promise<any> {
  const token = await getAccessToken();
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (resp.status === 429 && attempt < MAX_RETRIES) {
      const rateLimit = parseRateLimitHeaders(resp.headers);
      const waitMs = rateLimit
        ? Math.max(0, rateLimit.resetAt.getTime() - Date.now()) + 1000
        : (attempt + 1) * 15000; // fallback: 15s, 30s, 45s
      console.warn(`[xapi] Rate limited, waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`X API error: ${resp.status} ${text}`);
    }

    return resp.json();
  }
}
```

Apply the same 429 retry pattern to `searchRecentTweets` since it uses its own fetch call with the app bearer token (not `xApiFetch`). Wrap its fetch in the same retry loop.

- [ ] **Step 5: Commit**

```bash
git add lib/xapi/client.ts
git commit -m "feat(xapi): add following, timeline, search, and rate limit methods"
```

---

## Chunk 3: Discovery Source Modules

### Task 5: Following Source Module

**Files:**
- Create: `lib/discovery/sources/following.ts`

- [ ] **Step 1: Implement following source**

```typescript
// lib/discovery/sources/following.ts
import { getClient } from "@/lib/db/client";
import { fetchFollowing } from "@/lib/xapi/client";
import { getEndpointCost } from "../cost";
import type { BudgetTracker } from "../types";

export interface FollowedUser {
  id: string;
  username: string;
  name: string;
  profileImageUrl: string | null;
}

/**
 * Fetch the list of users that the authenticated user follows.
 * Caches results in DB — only re-fetches if cache is older than maxAgeMs.
 * Returns user IDs for use by timeline and second-degree modules.
 */
export async function getFollowingList(
  xUserId: string,
  userId: string,
  budget: BudgetTracker,
  maxAgeMs: number = 24 * 60 * 60 * 1000 // 24 hours default cache
): Promise<FollowedUser[]> {
  const prisma = await getClient();

  // Check cache first — look for recent high-water marks as a proxy
  // If we have any marks updated within maxAgeMs, the following list is fresh
  const recentMark = await prisma.highWaterMark.findFirst({
    where: {
      user_id: userId,
      updated_at: { gte: new Date(Date.now() - maxAgeMs) },
    },
  });

  // If cache is fresh, return from existing marks
  if (recentMark) {
    const marks = await prisma.highWaterMark.findMany({
      where: { user_id: userId },
      select: { source_user_id: true },
    });
    // We only have IDs from marks — return minimal info
    return marks.map((m) => ({
      id: m.source_user_id,
      username: "",
      name: "",
      profileImageUrl: null,
    }));
  }

  // Fetch from X API with pagination
  const users: FollowedUser[] = [];
  let nextToken: string | undefined;

  do {
    if (budget.isExhausted()) break;

    const costPerCall = getEndpointCost("following_list");
    budget.spend(costPerCall);

    const response = await fetchFollowing(xUserId, nextToken);
    const data = response.data || [];

    for (const user of data) {
      users.push({
        id: user.id,
        username: user.username,
        name: user.name,
        profileImageUrl: user.profile_image_url ?? null,
      });
    }

    nextToken = response.meta?.next_token;
  } while (nextToken);

  // Ensure high-water marks exist for all followed users
  for (const user of users) {
    await prisma.highWaterMark.upsert({
      where: {
        user_id_source_user_id: {
          user_id: userId,
          source_user_id: user.id,
        },
      },
      create: {
        user_id: userId,
        source_user_id: user.id,
        last_tweet_id: "0",
        miss_count: 0,
      },
      update: {}, // Just touch updated_at
    });
  }

  return users;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/discovery/sources/following.ts
git commit -m "feat(discovery): add following list source module"
```

### Task 6: Timeline Source Module

**Files:**
- Create: `lib/discovery/sources/timeline.ts`
- Create: `__tests__/discovery/timeline.test.ts`

- [ ] **Step 1: Write failing test for timeline source**

```typescript
// __tests__/discovery/timeline.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBudgetTracker } from "@/lib/discovery/cost";

// Mock the xapi client and db client
vi.mock("@/lib/xapi/client", () => ({
  fetchUserTimeline: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({
  getClient: vi.fn(),
}));

describe("fetchTimelines", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches tweets and updates high-water marks", async () => {
    const { fetchUserTimeline } = await import("@/lib/xapi/client");
    const { getClient } = await import("@/lib/db/client");

    const mockPrisma = {
      highWaterMark: {
        findUnique: vi.fn().mockResolvedValue({ id: "hw1", last_tweet_id: "100", miss_count: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    (getClient as any).mockResolvedValue(mockPrisma);
    (fetchUserTimeline as any).mockResolvedValue({
      data: [{ id: "200", author_id: "u1", text: "hello", public_metrics: {} }],
      includes: { users: [{ id: "u1", username: "test", name: "Test" }], media: [] },
    });

    const { fetchTimelines } = await import("@/lib/discovery/sources/timeline");
    const budget = createBudgetTracker(100);
    const result = await fetchTimelines(["u1"], "app-user-1", budget);

    expect(result.tweets).toHaveLength(1);
    expect(result.tweets[0].tweetId).toBe("200");
    expect(mockPrisma.highWaterMark.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ last_tweet_id: "200" }) })
    );
  });

  it("stops when budget is exhausted", async () => {
    const { fetchTimelines } = await import("@/lib/discovery/sources/timeline");
    const budget = createBudgetTracker(0); // No budget
    const result = await fetchTimelines(["u1", "u2"], "app-user-1", budget);
    expect(result.tweets).toHaveLength(0);
  });

  it("increments miss_count when no new tweets found", async () => {
    const { fetchUserTimeline } = await import("@/lib/xapi/client");
    const { getClient } = await import("@/lib/db/client");

    const mockPrisma = {
      highWaterMark: {
        findUnique: vi.fn().mockResolvedValue({ id: "hw1", last_tweet_id: "100", miss_count: 5 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    (getClient as any).mockResolvedValue(mockPrisma);
    (fetchUserTimeline as any).mockResolvedValue({ data: [] });

    const { fetchTimelines } = await import("@/lib/discovery/sources/timeline");
    const budget = createBudgetTracker(100);
    await fetchTimelines(["u1"], "app-user-1", budget);

    expect(mockPrisma.highWaterMark.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ miss_count: 6 }) })
    );
  });

  it("resets high-water mark after 7 consecutive misses", async () => {
    const { fetchUserTimeline } = await import("@/lib/xapi/client");
    const { getClient } = await import("@/lib/db/client");

    const mockPrisma = {
      highWaterMark: {
        findUnique: vi.fn().mockResolvedValue({ id: "hw1", last_tweet_id: "100", miss_count: 6 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    (getClient as any).mockResolvedValue(mockPrisma);
    (fetchUserTimeline as any).mockResolvedValue({ data: [] });

    const { fetchTimelines } = await import("@/lib/discovery/sources/timeline");
    const budget = createBudgetTracker(100);
    await fetchTimelines(["u1"], "app-user-1", budget);

    expect(mockPrisma.highWaterMark.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ last_tweet_id: "0" }) })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/discovery/timeline.test.ts`
Expected: FAIL — `lib/discovery/sources/timeline` not found

- [ ] **Step 3: Implement timeline source**

```typescript
// lib/discovery/sources/timeline.ts
import { getClient } from "@/lib/db/client";
import { fetchUserTimeline } from "@/lib/xapi/client";
import { getEndpointCost } from "../cost";
import type { BudgetTracker, DiscoveredTweet, SourceResult } from "../types";

/**
 * Fetch recent tweets from a list of user IDs.
 * Uses high-water marks to only pull new content since last fetch.
 * Stops early if budget is exhausted.
 */
export async function fetchTimelines(
  userIds: string[],
  appUserId: string,
  budget: BudgetTracker
): Promise<SourceResult> {
  const prisma = await getClient();
  const tweets: DiscoveredTweet[] = [];
  let costCents = 0;

  for (const sourceUserId of userIds) {
    if (budget.isExhausted()) break;

    // Get high-water mark
    const mark = await prisma.highWaterMark.findUnique({
      where: {
        user_id_source_user_id: {
          user_id: appUserId,
          source_user_id: sourceUserId,
        },
      },
    });

    const sinceId = mark?.last_tweet_id !== "0" ? mark?.last_tweet_id : undefined;

    try {
      const cost = getEndpointCost("user_timeline");
      budget.spend(cost);
      costCents += cost;

      const response = await fetchUserTimeline(sourceUserId, { sinceId });
      const data = response.data || [];
      const users = response.includes?.users || [];
      const media = response.includes?.media || [];

      if (data.length === 0) {
        // Track consecutive misses for stale mark detection
        if (mark) {
          const newMissCount = (mark.miss_count || 0) + 1;
          await prisma.highWaterMark.update({
            where: { id: mark.id },
            data: {
              miss_count: newMissCount,
              // Reset if 7 consecutive misses
              last_tweet_id: newMissCount >= 7 ? "0" : mark.last_tweet_id,
            },
          });
        }
        continue;
      }

      // Map tweets to DiscoveredTweet format
      for (const tweet of data) {
        const author = users.find((u: { id: string }) => u.id === tweet.author_id);
        const tweetMedia = (tweet.attachments?.media_keys || [])
          .map((key: string) => media.find((m: { media_key: string }) => m.media_key === key))
          .filter(Boolean)
          .map((m: { url?: string; preview_image_url?: string }) => m.url || m.preview_image_url)
          .filter(Boolean);

        tweets.push({
          tweetId: tweet.id,
          authorId: tweet.author_id || sourceUserId,
          authorHandle: author?.username || "",
          authorDisplayName: author?.name || "",
          authorAvatarUrl: author?.profile_image_url ?? null,
          text: tweet.note_tweet?.text || tweet.text || "",
          noteText: tweet.note_tweet?.text ?? null,
          createdAt: tweet.created_at ?? null,
          conversationId: tweet.conversation_id ?? null,
          metrics: {
            likes: tweet.public_metrics?.like_count ?? 0,
            retweets: tweet.public_metrics?.retweet_count ?? 0,
            replies: tweet.public_metrics?.reply_count ?? 0,
            views: tweet.public_metrics?.impression_count ?? 0,
          },
          mediaUrls: tweetMedia,
          rawJson: { ...tweet, _users: users, _media: media },
        });
      }

      // Update high-water mark to newest tweet ID
      const newestId = data[0].id;
      if (mark) {
        await prisma.highWaterMark.update({
          where: { id: mark.id },
          data: { last_tweet_id: newestId, miss_count: 0 },
        });
      }
    } catch (error) {
      // Log but continue to next user — don't fail entire run
      console.error(`[discovery] Failed to fetch timeline for ${sourceUserId}:`, error);
    }
  }

  return { tweets, costCents };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/discovery/timeline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/sources/timeline.ts __tests__/discovery/timeline.test.ts
git commit -m "feat(discovery): add timeline source module with high-water marks"
```

### Task 7: Search Source Module

**Files:**
- Create: `lib/discovery/sources/search.ts`
- Create: `__tests__/discovery/search.test.ts`

- [ ] **Step 1: Write failing test for search source**

```typescript
// __tests__/discovery/search.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBudgetTracker } from "@/lib/discovery/cost";

vi.mock("@/lib/xapi/client", () => ({
  searchRecentTweets: vi.fn(),
}));

describe("searchByInterests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("searches keywords and returns tweets", async () => {
    const { searchRecentTweets } = await import("@/lib/xapi/client");
    (searchRecentTweets as any).mockResolvedValue({
      data: [{ id: "300", author_id: "u2", text: "AI art rocks", public_metrics: {} }],
      includes: { users: [{ id: "u2", username: "artist", name: "Artist" }], media: [] },
    });

    const { searchByInterests } = await import("@/lib/discovery/sources/search");
    const budget = createBudgetTracker(100);
    const result = await searchByInterests(["AI art"], ["art"], budget);

    expect(result.tweets.length).toBeGreaterThan(0);
    expect(result.costCents).toBeGreaterThan(0);
  });

  it("stops when budget is exhausted", async () => {
    const { searchByInterests } = await import("@/lib/discovery/sources/search");
    const budget = createBudgetTracker(0);
    const result = await searchByInterests(["AI art"], [], budget);
    expect(result.tweets).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/discovery/search.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement search source**

```typescript
// lib/discovery/sources/search.ts
import { searchRecentTweets } from "@/lib/xapi/client";
import { getEndpointCost } from "../cost";
import type { BudgetTracker, DiscoveredTweet, SourceResult } from "../types";

/**
 * Search for tweets matching user's keywords and categories.
 * Uses app-level bearer token — no OAuth required.
 * Builds X API search queries from keywords and category terms.
 */
export async function searchByInterests(
  keywords: string[],
  categories: string[],
  budget: BudgetTracker
): Promise<SourceResult> {
  const tweets: DiscoveredTweet[] = [];
  let costCents = 0;

  // Build search queries — one per keyword/category to stay within query length limits
  const queries = buildSearchQueries(keywords, categories);

  for (const query of queries) {
    if (budget.isExhausted()) break;

    try {
      const cost = getEndpointCost("search_recent");
      budget.spend(cost);
      costCents += cost;

      const response = await searchRecentTweets(query, { maxResults: 50 });
      const data = response.data || [];
      const users = response.includes?.users || [];
      const media = response.includes?.media || [];

      for (const tweet of data) {
        const author = users.find((u: { id: string }) => u.id === tweet.author_id);
        const tweetMedia = (tweet.attachments?.media_keys || [])
          .map((key: string) => media.find((m: { media_key: string }) => m.media_key === key))
          .filter(Boolean)
          .map((m: { url?: string; preview_image_url?: string }) => m.url || m.preview_image_url)
          .filter(Boolean);

        tweets.push({
          tweetId: tweet.id,
          authorId: tweet.author_id || "",
          authorHandle: author?.username || "",
          authorDisplayName: author?.name || "",
          authorAvatarUrl: author?.profile_image_url ?? null,
          text: tweet.note_tweet?.text || tweet.text || "",
          noteText: tweet.note_tweet?.text ?? null,
          createdAt: tweet.created_at ?? null,
          conversationId: tweet.conversation_id ?? null,
          metrics: {
            likes: tweet.public_metrics?.like_count ?? 0,
            retweets: tweet.public_metrics?.retweet_count ?? 0,
            replies: tweet.public_metrics?.reply_count ?? 0,
            views: tweet.public_metrics?.impression_count ?? 0,
          },
          mediaUrls: tweetMedia,
          rawJson: { ...tweet, _users: users, _media: media },
        });
      }
    } catch (error) {
      console.error(`[discovery] Search failed for query "${query}":`, error);
    }
  }

  return { tweets, costCents };
}

/**
 * Build X API search queries from keywords and categories.
 * Each query limited to 512 chars (X API limit).
 * Excludes retweets and replies for cleaner results.
 */
function buildSearchQueries(keywords: string[], categories: string[]): string[] {
  const queries: string[] = [];
  const suffix = " -is:retweet -is:reply lang:en";

  // Each keyword gets its own query
  for (const kw of keywords) {
    const q = `${kw}${suffix}`;
    if (q.length <= 512) queries.push(q);
  }

  // Categories map to broader search terms
  for (const cat of categories) {
    const q = `${cat}${suffix}`;
    if (q.length <= 512) queries.push(q);
  }

  return queries;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/discovery/search.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/sources/search.ts __tests__/discovery/search.test.ts
git commit -m "feat(discovery): add search source module"
```

### Task 8: Second-Degree Source Module

**Files:**
- Create: `lib/discovery/sources/second-degree.ts`

- [ ] **Step 1: Implement second-degree source**

```typescript
// lib/discovery/sources/second-degree.ts
import { fetchFollowing } from "@/lib/xapi/client";
import { getEndpointCost } from "../cost";
import { fetchTimelines } from "./timeline";
import type { BudgetTracker, SourceResult } from "../types";

/**
 * Discover tweets from 2nd-degree connections.
 * Takes a sample of followed users, fetches THEIR following lists,
 * then pulls tweets from those 2nd-degree accounts.
 * Most expensive source — budget cap is strictly enforced.
 */
export async function fetchSecondDegree(
  followedUserIds: string[],
  appUserId: string,
  sampleSize: number,
  budget: BudgetTracker
): Promise<SourceResult> {
  let costCents = 0;

  // Sample a subset of followed users to expand
  const sampled = sampleArray(followedUserIds, sampleSize);
  const secondDegreeIds = new Set<string>();

  // Fetch following lists of sampled users
  for (const userId of sampled) {
    if (budget.isExhausted()) break;

    try {
      const cost = getEndpointCost("following_list");
      budget.spend(cost);
      costCents += cost;

      const response = await fetchFollowing(userId);
      const data = response.data || [];

      for (const user of data) {
        // Exclude users we already follow directly
        if (!followedUserIds.includes(user.id)) {
          secondDegreeIds.add(user.id);
        }
      }
    } catch (error) {
      console.error(`[discovery] Failed to fetch following for ${userId}:`, error);
    }
  }

  if (secondDegreeIds.size === 0 || budget.isExhausted()) {
    return { tweets: [], costCents };
  }

  // Fetch timelines from 2nd-degree users (capped to avoid runaway costs)
  const cappedIds = Array.from(secondDegreeIds).slice(0, 50);
  const timelineResult = await fetchTimelines(cappedIds, appUserId, budget);

  return {
    tweets: timelineResult.tweets,
    costCents: costCents + timelineResult.costCents,
  };
}

/** Randomly sample n items from an array */
function sampleArray<T>(arr: T[], n: number): T[] {
  if (n >= arr.length) return [...arr];
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/discovery/sources/second-degree.ts
git commit -m "feat(discovery): add second-degree source module"
```

---

## Chunk 4: Relevance Scoring & Feedback

### Task 9: Relevance Scoring Module

**Files:**
- Create: `lib/discovery/relevance.ts`
- Create: `__tests__/discovery/relevance.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/discovery/relevance.test.ts
import { describe, it, expect } from "vitest";
import { scoreRelevance, type RelevanceInput } from "@/lib/discovery/relevance";

describe("scoreRelevance", () => {
  const baseInput: RelevanceInput = {
    text: "Check out this amazing AI art generated with Midjourney",
    categories: ["art"],
    keywords: ["AI art"],
    userCategories: ["art", "technology"],
    userKeywords: ["AI art", "generative"],
    semanticScore: 0.8,
    feedbackPenalty: 0,
  };

  it("scores a perfect match highly", () => {
    const result = scoreRelevance(baseInput);
    expect(result.score).toBeGreaterThan(0.7);
    expect(result.reasons).toContain("category:art");
    expect(result.reasons.some((r) => r.startsWith("keyword:"))).toBe(true);
    expect(result.reasons.some((r) => r.startsWith("semantic:"))).toBe(true);
  });

  it("scores zero when nothing matches", () => {
    const result = scoreRelevance({
      ...baseInput,
      categories: ["sports"],
      keywords: [],
      userCategories: ["art"],
      userKeywords: ["AI art"],
      semanticScore: 0.1,
    });
    expect(result.score).toBeLessThan(0.2);
  });

  it("applies feedback penalty", () => {
    const withoutPenalty = scoreRelevance(baseInput);
    const withPenalty = scoreRelevance({ ...baseInput, feedbackPenalty: 0.3 });
    expect(withPenalty.score).toBe(withoutPenalty.score - 0.3);
  });

  it("clamps score to 0 minimum", () => {
    const result = scoreRelevance({
      ...baseInput,
      categories: [],
      keywords: [],
      semanticScore: 0.0,
      feedbackPenalty: 0.5,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("includes keyword match in reasons", () => {
    const result = scoreRelevance(baseInput);
    expect(result.reasons).toContain("keyword:AI art");
  });

  it("handles partial keyword matches", () => {
    const result = scoreRelevance({
      ...baseInput,
      keywords: [],
      userKeywords: ["generative art"],
    });
    // "generative" partially matches "AI art generated" — but keyword scoring
    // checks user keywords against tweet text, so "generative" should partial-match
    expect(result.score).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/discovery/relevance.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement relevance scoring**

```typescript
// lib/discovery/relevance.ts

export interface RelevanceInput {
  text: string;
  categories: string[];      // categories detected on the tweet
  keywords: string[];         // keywords found in the tweet
  userCategories: string[];   // user's configured interest categories
  userKeywords: string[];     // user's configured keywords
  semanticScore: number;      // 0.0-1.0 cosine similarity from embeddings
  feedbackPenalty: number;    // 0.0-0.3 penalty from irrelevant flags
}

export interface RelevanceResult {
  score: number;
  reasons: string[];
}

const CATEGORY_WEIGHT = 0.3;
const KEYWORD_WEIGHT = 0.3;
const SEMANTIC_WEIGHT = 0.4;

/**
 * Score a tweet's relevance against user config.
 * Returns 0.0-1.0 score and match reasons.
 */
export function scoreRelevance(input: RelevanceInput): RelevanceResult {
  const reasons: string[] = [];

  // Category match: 1.0 if any category overlaps, 0.0 otherwise
  const categoryMatch = input.categories.some((c) =>
    input.userCategories.includes(c)
  );
  const categoryScore = categoryMatch ? 1.0 : 0.0;
  if (categoryMatch) {
    const matched = input.categories.filter((c) =>
      input.userCategories.includes(c)
    );
    for (const c of matched) reasons.push(`category:${c}`);
  }

  // Keyword match: 1.0 if exact match, 0.5 if partial
  let keywordScore = 0;
  const textLower = input.text.toLowerCase();
  for (const kw of input.userKeywords) {
    const kwLower = kw.toLowerCase();
    if (textLower.includes(kwLower)) {
      keywordScore = 1.0;
      reasons.push(`keyword:${kw}`);
      break;
    }
    // Partial: check if any word in the keyword appears in text
    const kwWords = kwLower.split(/\s+/);
    if (kwWords.some((w) => w.length > 3 && textLower.includes(w))) {
      keywordScore = Math.max(keywordScore, 0.5);
      reasons.push(`keyword-partial:${kw}`);
    }
  }

  // Semantic score is already 0.0-1.0
  if (input.semanticScore > 0.3) {
    reasons.push(`semantic:${input.semanticScore.toFixed(2)}`);
  }

  const rawScore =
    categoryScore * CATEGORY_WEIGHT +
    keywordScore * KEYWORD_WEIGHT +
    input.semanticScore * SEMANTIC_WEIGHT;

  const score = Math.max(0, rawScore - input.feedbackPenalty);

  return { score: Math.round(score * 100) / 100, reasons };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/discovery/relevance.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/relevance.ts __tests__/discovery/relevance.test.ts
git commit -m "feat(discovery): add relevance scoring with weighted signals"
```

### Task 10: Feedback Penalty Module

**Files:**
- Create: `lib/discovery/feedback.ts`
- Create: `__tests__/discovery/feedback.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/discovery/feedback.test.ts
import { describe, it, expect } from "vitest";
import { computeFeedbackPenalty } from "@/lib/discovery/feedback";

describe("computeFeedbackPenalty", () => {
  it("returns 0 when no flagged embeddings exist", () => {
    const penalty = computeFeedbackPenalty([], [0.1, 0.2, 0.3]);
    expect(penalty).toBe(0);
  });

  it("returns heavy penalty for very similar content", () => {
    // Identical vectors = similarity 1.0
    const vec = [0.5, 0.5, 0.5];
    const penalty = computeFeedbackPenalty([vec], vec);
    expect(penalty).toBe(0.3);
  });

  it("returns moderate penalty for moderately similar content", () => {
    const flagged = [[0.5, 0.5, 0.5]];
    // Slightly different vector
    const incoming = [0.4, 0.5, 0.55];
    const penalty = computeFeedbackPenalty(flagged, incoming);
    // Cosine similarity should be > 0.70 but < 0.85
    expect(penalty).toBe(0.15);
  });

  it("returns 0 for dissimilar content", () => {
    const flagged = [[1, 0, 0]];
    const incoming = [0, 1, 0]; // Orthogonal
    const penalty = computeFeedbackPenalty(flagged, incoming);
    expect(penalty).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/discovery/feedback.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement feedback penalty**

```typescript
// lib/discovery/feedback.ts

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Compute penalty for an incoming tweet based on similarity to
 * previously flagged-as-irrelevant content.
 *
 * Returns:
 * - 0.3 if max similarity > 0.85 (heavy penalty)
 * - 0.15 if max similarity > 0.70 (moderate)
 * - 0.0 otherwise
 */
export function computeFeedbackPenalty(
  flaggedEmbeddings: number[][],
  incomingEmbedding: number[]
): number {
  if (flaggedEmbeddings.length === 0) return 0;

  let maxSim = 0;
  for (const flagged of flaggedEmbeddings) {
    const sim = cosineSimilarity(flagged, incomingEmbedding);
    if (sim > maxSim) maxSim = sim;
  }

  if (maxSim > 0.85) return 0.3;
  if (maxSim > 0.70) return 0.15;
  return 0;
}

/**
 * Load flagged item embeddings for a user from the database.
 * Only loads embeddings from items the user flagged as irrelevant.
 */
export async function loadFlaggedEmbeddings(userId: string): Promise<number[][]> {
  const { getClient } = await import("@/lib/db/client");
  const prisma = await getClient();

  // Get tweet IDs of flagged items
  const flaggedItems = await prisma.discoveryItem.findMany({
    where: { user_id: userId, status: "irrelevant" },
    select: { tweet_id: true },
    take: 200, // Cap to avoid loading too many embeddings
    orderBy: { created_at: "desc" },
  });

  if (flaggedItems.length === 0) return [];

  // Look up embeddings from ContentItem (if they were saved before being flagged)
  // and from raw_data embeddings stored during discovery
  const externalIds = flaggedItems.map((f) => f.tweet_id);
  const items = await prisma.contentItem.findMany({
    where: { external_id: { in: externalIds } },
    select: { id: true },
  });

  if (items.length === 0) return [];

  // Use raw SQL to read vector embeddings (Prisma can't read Unsupported types)
  const ids = items.map((i) => i.id);
  const result: { embedding: string }[] = await prisma.$queryRawUnsafe(
    `SELECT embedding::text FROM content_items WHERE id = ANY($1) AND embedding IS NOT NULL`,
    ids
  );

  return result
    .map((r) => {
      try {
        // pgvector returns "[0.1,0.2,...]" format
        return JSON.parse(r.embedding) as number[];
      } catch {
        return null;
      }
    })
    .filter((e): e is number[] => e !== null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/discovery/feedback.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/feedback.ts __tests__/discovery/feedback.test.ts
git commit -m "feat(discovery): add feedback penalty with cosine similarity"
```

---

## Chunk 5: Orchestrator

### Task 11: Orchestrator Module

**Files:**
- Create: `lib/discovery/orchestrator.ts`

- [ ] **Step 1: Implement the orchestrator**

```typescript
// lib/discovery/orchestrator.ts
import { getClient } from "@/lib/db/client";
import { loadTokens } from "@/lib/xapi/token-store";
import { createBudgetTracker } from "./cost";
import { getFollowingList } from "./sources/following";
import { fetchTimelines } from "./sources/timeline";
import { searchByInterests } from "./sources/search";
import { fetchSecondDegree } from "./sources/second-degree";
import { scoreRelevance } from "./relevance";
import { computeFeedbackPenalty, loadFlaggedEmbeddings } from "./feedback";
import { generateEmbedding } from "@/lib/embeddings/gemini";
import { getSearchProvider } from "@/lib/db/search-provider";
import type { DiscoveredTweet, DiscoveryMode, ScoredTweet, SourceConfig } from "./types";

export interface RunResult {
  runId: string;
  tweetsFound: number;
  tweetsSaved: number;
  duplicatesSkipped: number;
  apiCostCents: number;
  status: "completed" | "failed";
  errorMessage?: string;
}

/**
 * Execute a discovery run for a user.
 * Accepts an existing runId (created by the API route) to avoid double-creation.
 * Loads config, runs enabled sources in priority order,
 * deduplicates, scores, and saves results to inbox.
 * Enforces a 5-minute timeout — saves partial results if exceeded.
 */
export async function executeDiscoveryRun(
  userId: string,
  mode: DiscoveryMode,
  existingRunId: string
): Promise<RunResult> {
  const prisma = await getClient();

  // Load config for this mode
  const config = await prisma.discoveryConfig.findUnique({
    where: { user_id_mode: { user_id: userId, mode } },
  });
  if (!config) {
    throw new Error(`No ${mode} discovery config found for user`);
  }

  // Mark the existing run as running
  const run = await prisma.discoveryRun.update({
    where: { id: existingRunId },
    data: { status: "running", started_at: new Date() },
  });

  // 5-minute timeout — will set timedOut flag to save partial results
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; }, 5 * 60 * 1000);

  const budget = createBudgetTracker(config.budget_cents);
  const allTweets: DiscoveredTweet[] = [];
  let duplicatesSkipped = 0;

  try {
    const sourceConfig: SourceConfig = {
      userId,
      enabledSources: config.enabled_sources as DiscoveryMode extends string ? string[] : never,
      categories: config.categories,
      keywords: config.keywords,
      budgetCents: config.budget_cents,
      secondDegreeSampleSize: config.second_degree_sample_size,
      semanticMatchThreshold: config.semantic_match_threshold,
    };

    // Helper: check if we should stop (budget exhausted or timed out)
    const shouldStop = () => budget.isExhausted() || timedOut;

    // --- Source 1: Following timelines (requires OAuth) ---
    let followedUserIds: string[] = [];
    if (config.enabled_sources.includes("following") && !shouldStop()) {
      const tokens = await loadTokens();
      if (tokens) {
        const following = await getFollowingList(
          tokens.xUserId,
          userId,
          budget
        );
        followedUserIds = following.map((u) => u.id);

        if (!shouldStop()) {
          const timelineResult = await fetchTimelines(followedUserIds, userId, budget);
          allTweets.push(...timelineResult.tweets);
        }
      }
    }

    // --- Source 2: Search (app-level token, no OAuth) ---
    if (config.enabled_sources.includes("search") && !shouldStop()) {
      const searchResult = await searchByInterests(
        config.keywords,
        config.categories,
        budget
      );
      allTweets.push(...searchResult.tweets);
    }

    // --- Source 3: Second-degree (most expensive, runs last) ---
    if (
      config.enabled_sources.includes("second_degree") &&
      !shouldStop() &&
      followedUserIds.length > 0
    ) {
      const secondResult = await fetchSecondDegree(
        followedUserIds,
        userId,
        config.second_degree_sample_size,
        budget
      );
      allTweets.push(...secondResult.tweets);
    }

    // --- Deduplication ---
    const uniqueTweets = deduplicateByTweetId(allTweets);
    const tweetIds = uniqueTweets.map((t) => t.tweetId);

    // Check against existing Items
    const existingItems = await prisma.contentItem.findMany({
      where: { external_id: { in: tweetIds } },
      select: { external_id: true },
    });
    const existingIds = new Set(existingItems.map((i) => i.external_id));

    // Check against existing DiscoveryItems
    const existingDiscovery = await prisma.discoveryItem.findMany({
      where: { user_id: userId, tweet_id: { in: tweetIds } },
      select: { tweet_id: true },
    });
    const discoveryIds = new Set(existingDiscovery.map((d) => d.tweet_id));

    const newTweets = uniqueTweets.filter((t) => {
      if (existingIds.has(t.tweetId) || discoveryIds.has(t.tweetId)) {
        duplicatesSkipped++;
        return false;
      }
      return true;
    });

    // --- Scoring ---
    const flaggedEmbeddings = await loadFlaggedEmbeddings(userId);
    const searchProvider = await getSearchProvider();
    const scoredTweets: ScoredTweet[] = [];

    for (const tweet of newTweets) {
      // Generate embedding for the tweet text
      let semanticScore = 0;
      let feedbackPenalty = 0;

      try {
        const embedding = await generateEmbedding(tweet.text);

        // Find nearest saved item for semantic similarity
        const similar = await searchProvider.semanticSearch(
          embedding,
          {},
          { page: 1, perPage: 1 }
        );
        semanticScore = similar.length > 0 ? similar[0].relevance_score : 0;

        // Compute feedback penalty
        feedbackPenalty = computeFeedbackPenalty(flaggedEmbeddings, embedding);
      } catch (error) {
        console.error(`[discovery] Embedding failed for tweet ${tweet.tweetId}:`, error);
      }

      const result = scoreRelevance({
        text: tweet.text,
        categories: [], // TODO: run classifier on tweet text
        keywords: config.keywords.filter((kw) =>
          tweet.text.toLowerCase().includes(kw.toLowerCase())
        ),
        userCategories: config.categories,
        userKeywords: config.keywords,
        semanticScore,
        feedbackPenalty,
      });

      if (result.score >= config.semantic_match_threshold) {
        scoredTweets.push({
          ...tweet,
          relevanceScore: result.score,
          matchReasons: result.reasons,
        });
      }
    }

    // --- Save to inbox ---
    const sortedTweets = scoredTweets.sort(
      (a, b) => b.relevanceScore - a.relevanceScore
    );

    for (const tweet of sortedTweets) {
      await prisma.discoveryItem.create({
        data: {
          user_id: userId,
          run_id: run.id,
          tweet_id: tweet.tweetId,
          relevance_score: tweet.relevanceScore,
          match_reasons: tweet.matchReasons,
          status: "pending",
          raw_data: tweet.rawJson,
        },
      });
    }

    // --- Update run record ---
    clearTimeout(timeout);
    await prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        completed_at: new Date(),
        api_cost_cents: budget.spentCents,
        tweets_found: allTweets.length,
        tweets_saved: sortedTweets.length,
        duplicates_skipped: duplicatesSkipped,
        error_message: timedOut ? "Completed with timeout — partial results saved" : null,
      },
    });

    return {
      runId: run.id,
      tweetsFound: allTweets.length,
      tweetsSaved: sortedTweets.length,
      duplicatesSkipped,
      apiCostCents: budget.spentCents,
      status: "completed",
    };
  } catch (error) {
    clearTimeout(timeout);
    const message = error instanceof Error ? error.message : String(error);
    // Detect auth failures specifically for user notification
    const isAuthError = message.includes("401") || message.includes("403");

    await prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        completed_at: new Date(),
        api_cost_cents: budget.spentCents,
        error_message: isAuthError
          ? "X API authentication failed — reconnect your X account in Settings"
          : message,
      },
    });

    return {
      runId: run.id,
      tweetsFound: allTweets.length,
      tweetsSaved: 0,
      duplicatesSkipped,
      apiCostCents: budget.spentCents,
      status: "failed",
      errorMessage: message,
    };
  }
}

/** Deduplicate tweets by tweetId, keeping the first occurrence */
function deduplicateByTweetId(tweets: DiscoveredTweet[]): DiscoveredTweet[] {
  const seen = new Set<string>();
  return tweets.filter((t) => {
    if (seen.has(t.tweetId)) return false;
    seen.add(t.tweetId);
    return true;
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/discovery/orchestrator.ts
git commit -m "feat(discovery): add orchestrator with source composition and dedup"
```

---

## Chunk 6: API Routes

### Task 12: On-Demand Run API Route

**Files:**
- Create: `app/api/discovery/run/route.ts`

- [ ] **Step 1: Implement the on-demand run endpoint**

```typescript
// app/api/discovery/run/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { executeDiscoveryRun } from "@/lib/discovery/orchestrator";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fire and forget — run executes in background
    // Return the run ID immediately for polling
    const { getClient } = await import("@/lib/db/client");
    const prisma = await getClient();

    // Check for active run (pending or running)
    const activeRun = await prisma.discoveryRun.findFirst({
      where: {
        user_id: session.user.id,
        status: { in: ["pending", "running"] },
      },
    });
    if (activeRun) {
      return NextResponse.json(
        { error: "A discovery run is already in progress", runId: activeRun.id },
        { status: 409 }
      );
    }

    // Create the run record here — orchestrator receives the ID
    const run = await prisma.discoveryRun.create({
      data: {
        user_id: session.user.id,
        mode: "on_demand",
        status: "pending",
      },
    });

    // Execute in background (don't await) — pass existing runId
    executeDiscoveryRun(session.user.id, "on_demand", run.id).catch((error) => {
      console.error("[discovery] On-demand run failed:", error);
    });

    return NextResponse.json({ runId: run.id, status: "started" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET: poll for run status */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = request.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }

  const { getClient } = await import("@/lib/db/client");
  const prisma = await getClient();

  const run = await prisma.discoveryRun.findFirst({
    where: { id: runId, user_id: session.user.id },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: run.id,
    status: run.status,
    apiCostCents: run.api_cost_cents,
    tweetsFound: run.tweets_found,
    tweetsSaved: run.tweets_saved,
    duplicatesSkipped: run.duplicates_skipped,
    startedAt: run.started_at?.toISOString() ?? null,
    completedAt: run.completed_at?.toISOString() ?? null,
    errorMessage: run.error_message,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/discovery/run/route.ts
git commit -m "feat(discovery): add on-demand run API route"
```

### Task 13: Cron Run API Route

**Files:**
- Create: `app/api/discovery/cron/route.ts`
- Modify: `middleware.ts`

- [ ] **Step 1: Implement the cron endpoint**

```typescript
// app/api/discovery/cron/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/db/client";
import { executeDiscoveryRun } from "@/lib/discovery/orchestrator";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.DISCOVERY_CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = await getClient();

  // Find all users with active scheduled configs
  const configs = await prisma.discoveryConfig.findMany({
    where: { mode: "scheduled" },
    select: { user_id: true },
  });

  const results: { userId: string; status: string; error?: string }[] = [];

  // Execute sequentially per user — create run record first, pass ID
  for (const config of configs) {
    try {
      const run = await prisma.discoveryRun.create({
        data: {
          user_id: config.user_id,
          mode: "scheduled",
          status: "pending",
        },
      });
      const result = await executeDiscoveryRun(config.user_id, "scheduled", run.id);
      results.push({
        userId: config.user_id,
        status: result.status,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.push({
        userId: config.user_id,
        status: "failed",
        error: message,
      });
    }
  }

  return NextResponse.json({
    usersProcessed: configs.length,
    results,
  });
}
```

- [ ] **Step 2: Add cron route to middleware public paths**

In `middleware.ts`, add `/api/discovery/cron` to the public API routes list (it uses its own Bearer token auth, not session auth).

- [ ] **Step 3: Commit**

```bash
git add app/api/discovery/cron/route.ts middleware.ts
git commit -m "feat(discovery): add cron endpoint for scheduled runs"
```

### Task 14: Discovery Inbox API Route

**Files:**
- Create: `app/api/discovery/inbox/route.ts`

- [ ] **Step 1: Implement inbox GET and PATCH**

```typescript
// app/api/discovery/inbox/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getClient } from "@/lib/db/client";
import { ingestItem } from "@/lib/ingest";
import { mapTweetToPayload } from "@/lib/xapi/mapper";

/** GET: list pending discovery items */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = await getClient();
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10));
  const perPage = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get("per_page") || "20", 10)));

  const [items, total] = await Promise.all([
    prisma.discoveryItem.findMany({
      where: { user_id: session.user.id, status: "pending" },
      orderBy: { relevance_score: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.discoveryItem.count({
      where: { user_id: session.user.id, status: "pending" },
    }),
  ]);

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      tweetId: item.tweet_id,
      relevanceScore: item.relevance_score,
      matchReasons: item.match_reasons,
      rawData: item.raw_data,
      createdAt: item.created_at.toISOString(),
    })),
    total,
    page,
    perPage,
  });
}

/** PATCH: update item status (save, dismiss, flag as irrelevant) */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { itemId, action } = body as { itemId: string; action: string };

  if (!itemId || !["save", "dismiss", "irrelevant"].includes(action)) {
    return NextResponse.json(
      { error: "itemId and action (save|dismiss|irrelevant) required" },
      { status: 400 }
    );
  }

  const prisma = await getClient();

  const item = await prisma.discoveryItem.findFirst({
    where: { id: itemId, user_id: session.user.id },
  });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (action === "save") {
    // Ingest the tweet through the standard pipeline
    try {
      const rawData = item.raw_data as Record<string, unknown>;
      // Re-map from raw tweet data to CapturePayload
      const payload = mapTweetToPayload(
        rawData as any,
        (rawData._users as any[]) || [],
        (rawData._media as any[]) || []
      );
      await ingestItem(payload);
    } catch (error) {
      console.error(`[discovery] Failed to save item ${itemId}:`, error);
      return NextResponse.json(
        { error: "Failed to save tweet to library" },
        { status: 500 }
      );
    }
  }

  const statusMap: Record<string, string> = {
    save: "saved",
    dismiss: "dismissed",
    irrelevant: "irrelevant",
  };

  await prisma.discoveryItem.update({
    where: { id: itemId },
    data: { status: statusMap[action] as any },
  });

  return NextResponse.json({ success: true, status: statusMap[action] });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/discovery/inbox/route.ts
git commit -m "feat(discovery): add inbox API with save/dismiss/flag actions"
```

### Task 15: Run History API Route

**Files:**
- Create: `app/api/discovery/history/route.ts`

- [ ] **Step 1: Implement history endpoint**

```typescript
// app/api/discovery/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getClient } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = await getClient();
  const limit = Math.min(20, parseInt(request.nextUrl.searchParams.get("limit") || "10", 10));

  const runs = await prisma.discoveryRun.findMany({
    where: { user_id: session.user.id },
    orderBy: { created_at: "desc" },
    take: limit,
  });

  return NextResponse.json({
    runs: runs.map((run) => ({
      id: run.id,
      mode: run.mode,
      status: run.status,
      apiCostCents: run.api_cost_cents,
      tweetsFound: run.tweets_found,
      tweetsSaved: run.tweets_saved,
      duplicatesSkipped: run.duplicates_skipped,
      startedAt: run.started_at?.toISOString() ?? null,
      completedAt: run.completed_at?.toISOString() ?? null,
      errorMessage: run.error_message,
    })),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/discovery/history/route.ts
git commit -m "feat(discovery): add run history API route"
```

---

## Chunk 7: Discovery Settings API

### Task 16: Discovery Config API Route

**Files:**
- Create: `app/api/settings/discovery/route.ts`

- [ ] **Step 1: Implement config GET and PUT**

```typescript
// app/api/settings/discovery/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getClient } from "@/lib/db/client";

/** GET: fetch both scheduled and on-demand configs */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = await getClient();
  const configs = await prisma.discoveryConfig.findMany({
    where: { user_id: session.user.id },
  });

  const scheduled = configs.find((c) => c.mode === "scheduled") ?? null;
  const onDemand = configs.find((c) => c.mode === "on_demand") ?? null;

  const format = (c: typeof scheduled) =>
    c
      ? {
          enabledSources: c.enabled_sources,
          categories: c.categories,
          keywords: c.keywords,
          budgetCents: c.budget_cents,
          secondDegreeSampleSize: c.second_degree_sample_size,
          semanticMatchThreshold: c.semantic_match_threshold,
        }
      : null;

  return NextResponse.json({
    scheduled: format(scheduled),
    onDemand: format(onDemand),
  });
}

/** PUT: update config for a specific mode */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { mode, enabledSources, categories, keywords, budgetCents, secondDegreeSampleSize, semanticMatchThreshold } =
    body as {
      mode: "scheduled" | "on_demand";
      enabledSources: string[];
      categories: string[];
      keywords: string[];
      budgetCents: number;
      secondDegreeSampleSize: number;
      semanticMatchThreshold: number;
    };

  if (!mode || !["scheduled", "on_demand"].includes(mode)) {
    return NextResponse.json({ error: "mode must be scheduled or on_demand" }, { status: 400 });
  }

  const prisma = await getClient();

  const config = await prisma.discoveryConfig.upsert({
    where: {
      user_id_mode: { user_id: session.user.id, mode },
    },
    create: {
      user_id: session.user.id,
      mode,
      enabled_sources: enabledSources,
      categories,
      keywords,
      budget_cents: budgetCents,
      second_degree_sample_size: secondDegreeSampleSize,
      semantic_match_threshold: semanticMatchThreshold,
    },
    update: {
      enabled_sources: enabledSources,
      categories,
      keywords,
      budget_cents: budgetCents,
      second_degree_sample_size: secondDegreeSampleSize,
      semantic_match_threshold: semanticMatchThreshold,
    },
  });

  return NextResponse.json({ success: true, config });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/settings/discovery/route.ts
git commit -m "feat(discovery): add settings config API route"
```

---

## Chunk 8: Frontend — Discovery Inbox Page

### Task 17: Discovery Page Shell

**Files:**
- Create: `app/discovery/page.tsx`
- Create: `components/discovery/discovery-page.tsx`

- [ ] **Step 1: Create the server component page shell**

```typescript
// app/discovery/page.tsx
import { DiscoveryPage } from "@/components/discovery/discovery-page";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getClient } from "@/lib/db/client";

export default async function Discovery() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const prisma = await getClient();
  const stats = await prisma.contentItem.count();

  return <DiscoveryPage captureCount={stats} isAuthed={true} />;
}
```

- [ ] **Step 2: Create the main discovery page client component**

```typescript
// components/discovery/discovery-page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { DiscoveryCard } from "./discovery-card";
import { RunHistory } from "./run-history";
import { RunTrigger } from "./run-trigger";

interface DiscoveryItemData {
  id: string;
  tweetId: string;
  relevanceScore: number;
  matchReasons: string[];
  rawData: Record<string, unknown>;
  createdAt: string;
}

interface DiscoveryPageProps {
  captureCount: number;
  isAuthed: boolean;
}

export function DiscoveryPage({ captureCount, isAuthed }: DiscoveryPageProps) {
  const [items, setItems] = useState<DiscoveryItemData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/discovery/inbox?page=${page}&per_page=20`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error("Failed to fetch discovery items:", error);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAction = async (itemId: string, action: "save" | "dismiss" | "irrelevant") => {
    try {
      const res = await fetch("/api/discovery/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, action }),
      });
      if (!res.ok) throw new Error("Action failed");

      // Remove from list optimistically
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setTotal((prev) => prev - 1);
    } catch (error) {
      console.error(`Failed to ${action} item:`, error);
    }
  };

  return (
    <div className="relative z-10 mx-auto max-w-[1440px] px-4 pb-16 sm:px-6 lg:px-8">
      <Header captureCount={captureCount} isAuthed={isAuthed} currentPath="/discovery" />

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_340px]">
        {/* Main inbox */}
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-[#f2ede5]">
                Discovery Inbox
              </h1>
              <p className="mt-1 text-sm text-[#b4ab9d]">
                {total} items waiting for review
              </p>
            </div>
            <RunTrigger onComplete={fetchItems} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#f2ede5] border-t-transparent" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-[28px] border border-[#d6c9b214] bg-[#ffffff08] p-12 text-center">
              <p className="text-[#b4ab9d]">No discoveries waiting. Run a search to find new content.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((item) => (
                <DiscoveryCard
                  key={item.id}
                  item={item}
                  onSave={() => handleAction(item.id, "save")}
                  onDismiss={() => handleAction(item.id, "dismiss")}
                  onFlagIrrelevant={() => handleAction(item.id, "irrelevant")}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > 20 && (
            <div className="mt-6 flex justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-[#d6c9b214] bg-[#ffffff08] px-4 py-2 text-sm text-[#b4ab9d] disabled:opacity-40"
              >
                Previous
              </button>
              <span className="flex items-center px-3 text-sm text-[#b4ab9d]">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / 20)}
                className="rounded-lg border border-[#d6c9b214] bg-[#ffffff08] px-4 py-2 text-sm text-[#b4ab9d] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Sidebar: Run History */}
        <aside>
          <RunHistory />
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/discovery/page.tsx components/discovery/discovery-page.tsx
git commit -m "feat(discovery): add discovery inbox page shell"
```

### Task 18: Discovery Card Component

**Files:**
- Create: `components/discovery/discovery-card.tsx`

- [ ] **Step 1: Implement the discovery card**

```typescript
// components/discovery/discovery-card.tsx
"use client";

import { Check, X, Flag } from "lucide-react";

interface DiscoveryCardProps {
  item: {
    id: string;
    tweetId: string;
    relevanceScore: number;
    matchReasons: string[];
    rawData: Record<string, unknown>;
  };
  onSave: () => void;
  onDismiss: () => void;
  onFlagIrrelevant: () => void;
}

export function DiscoveryCard({ item, onSave, onDismiss, onFlagIrrelevant }: DiscoveryCardProps) {
  const raw = item.rawData as any;
  const text = raw.note_tweet?.text || raw.text || "";
  const authorHandle = raw._authorHandle || "";
  const authorName = raw._authorName || "";
  const authorAvatar = raw._authorAvatar || "";
  const createdAt = raw.created_at || "";
  const metrics = raw.public_metrics || {};

  return (
    <div className="group rounded-[20px] border border-[#d6c9b214] bg-[#ffffff08] p-5 transition-colors hover:border-[#d6c9b230]">
      {/* Header: author + relevance score */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {authorAvatar && (
            <img
              src={authorAvatar}
              alt=""
              className="h-10 w-10 rounded-full"
            />
          )}
          <div>
            <p className="text-sm font-medium text-[#f2ede5]">{authorName}</p>
            <p className="text-xs text-[#b4ab9d]">@{authorHandle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#ffffff12] px-2.5 py-1 text-xs font-medium text-[#f2ede5]">
            {Math.round(item.relevanceScore * 100)}% match
          </span>
        </div>
      </div>

      {/* Tweet text */}
      <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-[#d4cdc3]">
        {text.length > 500 ? text.slice(0, 500) + "..." : text}
      </p>

      {/* Match reasons */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {item.matchReasons.map((reason, i) => (
          <span
            key={i}
            className="rounded-full bg-[#ffffff0a] px-2 py-0.5 text-[11px] text-[#a49b8b]"
          >
            {reason}
          </span>
        ))}
      </div>

      {/* Metrics */}
      <div className="mb-4 flex gap-4 text-xs text-[#a49b8b]">
        {metrics.like_count > 0 && <span>{metrics.like_count.toLocaleString()} likes</span>}
        {metrics.retweet_count > 0 && <span>{metrics.retweet_count.toLocaleString()} retweets</span>}
        {metrics.impression_count > 0 && <span>{metrics.impression_count.toLocaleString()} views</span>}
        {createdAt && (
          <span>{new Date(createdAt).toLocaleDateString()}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30"
        >
          <Check className="h-3.5 w-3.5" />
          Save
        </button>
        <button
          onClick={onDismiss}
          className="flex items-center gap-1.5 rounded-lg bg-[#ffffff0a] px-3 py-1.5 text-xs font-medium text-[#b4ab9d] transition-colors hover:bg-[#ffffff14]"
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </button>
        <button
          onClick={onFlagIrrelevant}
          className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400/80 transition-colors hover:bg-red-500/20"
        >
          <Flag className="h-3.5 w-3.5" />
          Irrelevant
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/discovery/discovery-card.tsx
git commit -m "feat(discovery): add discovery card with action buttons"
```

### Task 19: Run Trigger and History Components

**Files:**
- Create: `components/discovery/run-trigger.tsx`
- Create: `components/discovery/run-history.tsx`

- [ ] **Step 1: Implement run trigger button**

```typescript
// components/discovery/run-trigger.tsx
"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface RunTriggerProps {
  onComplete: () => void;
}

export function RunTrigger({ onComplete }: RunTriggerProps) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");

  const startRun = async () => {
    setRunning(true);
    setStatus("Starting...");

    try {
      const res = await fetch("/api/discovery/run", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setStatus(data.error || "Failed to start");
        setRunning(false);
        return;
      }

      const { runId } = await res.json();
      setStatus("Running...");

      // Poll for completion
      const poll = async () => {
        const statusRes = await fetch(`/api/discovery/run?runId=${runId}`);
        const statusData = await statusRes.json();

        if (statusData.status === "completed") {
          setStatus(`Found ${statusData.tweetsSaved} new items`);
          setRunning(false);
          onComplete();
          setTimeout(() => setStatus(""), 3000);
        } else if (statusData.status === "failed") {
          setStatus(statusData.errorMessage || "Run failed");
          setRunning(false);
        } else {
          setTimeout(poll, 2000);
        }
      };

      setTimeout(poll, 2000);
    } catch (error) {
      setStatus("Error starting run");
      setRunning(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {status && <span className="text-xs text-[#b4ab9d]">{status}</span>}
      <button
        onClick={startRun}
        disabled={running}
        className="flex items-center gap-2 rounded-xl bg-[#f2ede5] px-4 py-2 text-sm font-medium text-[#1a1915] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {running ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1a1915] border-t-transparent" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        Discover
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Implement run history sidebar**

```typescript
// components/discovery/run-history.tsx
"use client";

import { useState, useEffect } from "react";

interface RunData {
  id: string;
  mode: string;
  status: string;
  apiCostCents: number;
  tweetsFound: number;
  tweetsSaved: number;
  completedAt: string | null;
  errorMessage: string | null;
}

export function RunHistory() {
  const [runs, setRuns] = useState<RunData[]>([]);

  useEffect(() => {
    fetch("/api/discovery/history?limit=10")
      .then((res) => res.json())
      .then((data) => setRuns(data.runs))
      .catch(console.error);
  }, []);

  if (runs.length === 0) {
    return (
      <div className="rounded-[20px] border border-[#d6c9b214] bg-[#ffffff08] p-5">
        <h3 className="mb-3 text-sm font-medium text-[#f2ede5]">Run History</h3>
        <p className="text-xs text-[#b4ab9d]">No runs yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border border-[#d6c9b214] bg-[#ffffff08] p-5">
      <h3 className="mb-4 text-sm font-medium text-[#f2ede5]">Run History</h3>
      <div className="flex flex-col gap-3">
        {runs.map((run) => (
          <div
            key={run.id}
            className="rounded-lg border border-[#d6c9b20a] bg-[#ffffff06] p-3"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-[#a49b8b]">
                {run.mode === "scheduled" ? "Scheduled" : "On-demand"}
              </span>
              <span
                className={`text-[11px] font-medium ${
                  run.status === "completed"
                    ? "text-emerald-400"
                    : run.status === "failed"
                      ? "text-red-400"
                      : "text-amber-400"
                }`}
              >
                {run.status}
              </span>
            </div>
            <div className="flex gap-3 text-xs text-[#b4ab9d]">
              <span>{run.tweetsSaved} saved</span>
              <span>{run.tweetsFound} found</span>
              <span>${(run.apiCostCents / 100).toFixed(2)}</span>
            </div>
            {run.completedAt && (
              <p className="mt-1 text-[11px] text-[#a49b8b80]">
                {new Date(run.completedAt).toLocaleString()}
              </p>
            )}
            {run.errorMessage && (
              <p className="mt-1 text-[11px] text-red-400/70">{run.errorMessage}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/discovery/run-trigger.tsx components/discovery/run-history.tsx
git commit -m "feat(discovery): add run trigger and history components"
```

---

## Chunk 9: Discovery Settings UI

### Task 20: Discovery Settings Section

**Files:**
- Create: `components/settings/sections/discovery-section.tsx`
- Modify: `components/settings/settings-page.tsx`

- [ ] **Step 1: Implement discovery settings section**

```typescript
// components/settings/sections/discovery-section.tsx
"use client";

import { useState, useEffect } from "react";

interface DiscoveryConfigData {
  enabledSources: string[];
  categories: string[];
  keywords: string[];
  budgetCents: number;
  secondDegreeSampleSize: number;
  semanticMatchThreshold: number;
}

type Mode = "scheduled" | "on_demand";

export function DiscoverySection() {
  const [activeTab, setActiveTab] = useState<Mode>("scheduled");
  const [configs, setConfigs] = useState<{
    scheduled: DiscoveryConfigData | null;
    onDemand: DiscoveryConfigData | null;
  }>({ scheduled: null, onDemand: null });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Form state
  const [enabledSources, setEnabledSources] = useState<string[]>(["following"]);
  const [categories, setCategories] = useState("");
  const [keywords, setKeywords] = useState("");
  const [budgetCents, setBudgetCents] = useState(100);
  const [sampleSize, setSampleSize] = useState(10);
  const [threshold, setThreshold] = useState(0.4);

  useEffect(() => {
    fetch("/api/settings/discovery")
      .then((res) => res.json())
      .then((data) => {
        setConfigs(data);
        loadTabConfig(data, activeTab);
      })
      .catch(console.error);
  }, []);

  const loadTabConfig = (
    data: { scheduled: DiscoveryConfigData | null; onDemand: DiscoveryConfigData | null },
    tab: Mode
  ) => {
    const config = tab === "scheduled" ? data.scheduled : data.onDemand;
    if (config) {
      setEnabledSources(config.enabledSources);
      setCategories(config.categories.join(", "));
      setKeywords(config.keywords.join(", "));
      setBudgetCents(config.budgetCents);
      setSampleSize(config.secondDegreeSampleSize);
      setThreshold(config.semanticMatchThreshold);
    } else {
      // Defaults
      setEnabledSources(["following"]);
      setCategories("");
      setKeywords("");
      setBudgetCents(100);
      setSampleSize(10);
      setThreshold(0.4);
    }
  };

  const switchTab = (tab: Mode) => {
    setActiveTab(tab);
    loadTabConfig(configs, tab);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/settings/discovery", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: activeTab,
          enabledSources,
          categories: categories
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          keywords: keywords
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          budgetCents,
          secondDegreeSampleSize: sampleSize,
          semanticMatchThreshold: threshold,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");
      setMessage("Saved!");
      setTimeout(() => setMessage(""), 2000);
    } catch {
      setMessage("Error saving config");
    } finally {
      setSaving(false);
    }
  };

  const toggleSource = (source: string) => {
    setEnabledSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Tabs */}
      <div className="flex gap-2">
        {(["scheduled", "on_demand"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-[#f2ede5] text-[#1a1915]"
                : "bg-[#ffffff0a] text-[#b4ab9d] hover:bg-[#ffffff14]"
            }`}
          >
            {tab === "scheduled" ? "Scheduled" : "On-Demand"}
          </button>
        ))}
      </div>

      {/* Sources */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#a49b8b]">
          Sources
        </label>
        <div className="flex flex-wrap gap-2">
          {["following", "search", "second_degree"].map((source) => (
            <button
              key={source}
              onClick={() => toggleSource(source)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                enabledSources.includes(source)
                  ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                  : "border-[#d6c9b214] bg-[#ffffff06] text-[#b4ab9d]"
              }`}
            >
              {source === "following"
                ? "Following"
                : source === "search"
                  ? "Search"
                  : "2nd Degree"}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#a49b8b]">
          Interest Categories (comma-separated)
        </label>
        <input
          type="text"
          value={categories}
          onChange={(e) => setCategories(e.target.value)}
          placeholder="art, technology, AI, design"
          className="w-full rounded-lg border border-[#d6c9b214] bg-[#ffffff08] px-3 py-2 text-sm text-[#f2ede5] placeholder:text-[#a49b8b60]"
        />
      </div>

      {/* Keywords */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#a49b8b]">
          Keywords (comma-separated)
        </label>
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="AI art, generative, Midjourney, stable diffusion"
          className="w-full rounded-lg border border-[#d6c9b214] bg-[#ffffff08] px-3 py-2 text-sm text-[#f2ede5] placeholder:text-[#a49b8b60]"
        />
      </div>

      {/* Budget */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#a49b8b]">
          Budget per run: ${(budgetCents / 100).toFixed(2)}
        </label>
        <input
          type="range"
          min={10}
          max={1000}
          step={10}
          value={budgetCents}
          onChange={(e) => setBudgetCents(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-[11px] text-[#a49b8b80]">
          <span>$0.10</span>
          <span>$10.00</span>
        </div>
      </div>

      {/* Second degree sample size */}
      {enabledSources.includes("second_degree") && (
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#a49b8b]">
            2nd Degree Sample Size: {sampleSize} accounts
          </label>
          <input
            type="range"
            min={1}
            max={50}
            value={sampleSize}
            onChange={(e) => setSampleSize(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      )}

      {/* Relevance threshold */}
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#a49b8b]">
          Relevance Threshold: {Math.round(threshold * 100)}%
        </label>
        <input
          type="range"
          min={10}
          max={90}
          value={Math.round(threshold * 100)}
          onChange={(e) => setThreshold(parseInt(e.target.value) / 100)}
          className="w-full"
        />
        <div className="flex justify-between text-[11px] text-[#a49b8b80]">
          <span>Broad (10%)</span>
          <span>Strict (90%)</span>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-[#f2ede5] px-5 py-2 text-sm font-medium text-[#1a1915] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Config"}
        </button>
        {message && <span className="text-xs text-[#b4ab9d]">{message}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add DiscoverySection to settings page**

In `components/settings/settings-page.tsx`, add the import and render the section:

```typescript
import { DiscoverySection } from "./sections/discovery-section";
```

Then add a new `SectionGroup` block after the existing sections:

```typescript
<SectionGroup title="Discovery" description="Configure automated content discovery from X/Twitter.">
  <DiscoverySection />
</SectionGroup>
```

- [ ] **Step 3: Add /discovery to header navigation**

In `components/header.tsx`, add a navigation link to `/discovery` alongside existing nav items.

- [ ] **Step 4: Commit**

```bash
git add components/settings/sections/discovery-section.tsx components/settings/settings-page.tsx components/header.tsx
git commit -m "feat(discovery): add settings UI and navigation link"
```

---

## Chunk 10: Integration & Middleware

### Task 21: Protect Discovery Routes in Middleware

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Add discovery routes to protected paths**

Add `/discovery` to the protected pages list (requires session), and ensure `/api/discovery/cron` is accessible with its own Bearer auth (not session auth), while other `/api/discovery/*` routes require session auth.

Review the existing middleware patterns and add:
- `/discovery` to the session-protected page routes
- `/api/discovery/cron` to the public API routes (it handles its own auth)
- `/api/discovery/*` (except cron) to the session-protected API routes

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat(discovery): protect discovery routes in middleware"
```

### Task 22: Store Author Info in Raw Data for Inbox Cards

**Files:**
- Modify: `lib/discovery/orchestrator.ts`

- [ ] **Step 1: Enrich rawJson before storing**

In the orchestrator, before saving `DiscoveryItem`, augment `rawJson` with resolved author info so the inbox card can display it without extra API calls:

In the orchestrator's scoring loop, after creating each `ScoredTweet`, add the author metadata to `rawJson`:

```typescript
tweet.rawJson._authorHandle = tweet.authorHandle;
tweet.rawJson._authorName = tweet.authorDisplayName;
tweet.rawJson._authorAvatar = tweet.authorAvatarUrl;
```

- [ ] **Step 2: Commit**

```bash
git add lib/discovery/orchestrator.ts
git commit -m "fix(discovery): embed author info in rawJson for inbox display"
```

### Task 23: Add DISCOVERY_CRON_SECRET to Environment

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the env var to .env.example**

Add to `.env.example`:

```
# Discovery cron endpoint protection
DISCOVERY_CRON_SECRET=
```

- [ ] **Step 2: Generate and add to local .env**

```bash
# Generate a random secret and add to .env
echo "DISCOVERY_CRON_SECRET=$(openssl rand -hex 32)" >> .env
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "feat(discovery): add DISCOVERY_CRON_SECRET to env example"
```

---

## Deferred Items (Post-MVP)

These items from the spec are intentionally deferred to keep the initial implementation focused:

- **Monthly cost aggregation** — Run-level cost tracking is in place. Monthly rollup queries and a billing dashboard will be added when multi-user is implemented.
- **Estimated cost per run in settings** — Requires historical run data to compute averages. Will add after initial usage generates enough data points.
- **Subscription tier enforcement** — Data model supports it. Tier-gating logic added when monetization launches.

---

## Chunk 11: End-to-End Verification

### Task 24: Manual Integration Test

- [ ] **Step 1: Verify Prisma migration**

```bash
npx prisma migrate status
```

Expected: All migrations applied.

- [ ] **Step 2: Verify app builds**

```bash
npx next build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass (existing + new discovery tests).

- [ ] **Step 4: Verify discovery settings page loads**

Start dev server, navigate to `/settings`, verify the Discovery section renders with scheduled/on-demand tabs.

- [ ] **Step 5: Verify discovery inbox page loads**

Navigate to `/discovery`, verify the empty state renders.

- [ ] **Step 6: Create a test discovery config via settings**

Configure a simple on-demand config with:
- Sources: search only
- Keywords: a topic you know has tweets
- Budget: $0.10 (10 cents)
- Threshold: 20%

- [ ] **Step 7: Trigger an on-demand discovery run**

Click the Discover button on `/discovery`. Monitor the console for API calls and any errors. Verify:
- Run appears in history sidebar
- Cost is tracked
- Any found items appear in the inbox

- [ ] **Step 8: Test inbox actions**

Save one item, dismiss one, flag one as irrelevant. Verify each disappears from the inbox.

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat(discovery): complete automated content discovery system"
```
