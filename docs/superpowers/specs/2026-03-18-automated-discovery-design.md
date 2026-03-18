# Automated Content Discovery via X API

**Date:** 2026-03-18
**Status:** Approved
**Approach:** Phased Hybrid (simple now, queue-ready later)

## Problem

FeedSilo currently requires manual scrolling on Twitter/X to find content worth saving. The goal is to automate discovery — pulling relevant tweets from followed accounts, their networks, and trending topics — while controlling X API pay-per-use costs.

## Architecture Overview

Phased hybrid approach: independent discovery modules composed by a thin orchestrator, backed by a DB job table for scheduling and cost tracking. Designed to lift into a proper job queue (BullMQ/Redis) when multi-user concurrency demands it.

## Discovery Modules

Five independent modules under `lib/discovery/`:

### `sources/following.ts`
- Fetches user's following list via OAuth
- Caches following list in DB (refreshed periodically, not every run)
- Returns user IDs for timeline fetching

### `sources/timeline.ts`
- Fetches recent tweets from a list of user IDs
- Uses `since_id` high-water marks per source user to only pull new content
- Handles pagination within budget constraints

### `sources/second-degree.ts`
- Takes a subset of followed user IDs, fetches their following lists
- Pulls tweets from those 2nd-degree accounts
- Most expensive tier — budget cap strictly enforced
- Sample size is user-configurable to control cost

### `sources/search.ts`
- Keyword/topic searches via X API search endpoint
- Uses app-level bearer token (no OAuth required)
- Supports trending topic discovery

### `relevance.ts`
- Scores incoming tweets against user config:
  - Category matches (using existing content classifier)
  - Keyword hits
  - Semantic similarity via Gemini embeddings against user's existing library
- Applies negative signal from "flag as irrelevant" feedback
- Returns scored + ranked results

### Module Interface
Each module accepts config + budget remaining, returns tweets found + API cost incurred. Modules stop early if budget is exhausted.

## Data Model

### `DiscoveryConfig`
Per-user configuration, stored separately for scheduled vs. on-demand:
- `userId`, `mode` (scheduled | on_demand)
- `enabledSources` — which tiers are active (following, second_degree, search)
- `categories` — selected interest categories
- `keywords` — custom keyword/topic list
- `budgetCents` — max API spend per run (in cents)
- `secondDegreeSampleSize` — how many followed accounts to expand
- `semanticMatchThreshold` — minimum similarity score

### `DiscoveryRun`
Job table tracking each execution:
- `userId`, `mode`, `status` (pending | running | completed | failed)
- `startedAt`, `completedAt`
- `apiCostCents` — actual cost incurred
- `tweetsFound`, `tweetsSaved`, `duplicatesSkipped`
- `errorMessage` (if failed)

### `DiscoveryItem`
The discovery inbox — each tweet before the user acts on it:
- `userId`, `runId`, `tweetId` (X API tweet ID)
- `relevanceScore` — computed by relevance module
- `matchReasons` — JSON array (e.g., `["keyword:AI art", "category:art", "semantic:0.82"]`)
- `status` (pending | saved | dismissed | irrelevant)
- `rawData` — cached tweet JSON (avoids re-fetch on save)

### `HighWaterMark`
Tracks last seen tweet ID per source per user:
- `userId`, `sourceUserId`, `lastTweetId`
- Updated after each successful pull
- Critical for cost control — prevents redundant fetching

### Existing Model Changes
- `User` gets relations to DiscoveryConfig, DiscoveryRun, DiscoveryItem
- No changes to existing `Item` table — saved discoveries go through existing ingest pipeline

## Orchestrator & Cost Tracking

### `lib/discovery/orchestrator.ts`

Execution flow:
1. Load user's config (scheduled or on-demand)
2. Create `DiscoveryRun` record (status: running)
3. Execute enabled source modules in priority order: **following -> search -> second_degree**
4. Each module receives `budgetRemaining` (total budget minus cost so far); if zero, remaining modules skipped
5. Deduplicate against `Item` table + `DiscoveryItem` table by tweet ID
6. Score through relevance module
7. Insert qualifying tweets into `DiscoveryItem` as pending
8. Update `DiscoveryRun` with final stats and cost

### Cost Tracking
- Each X API endpoint has a known cost-per-request
- Modules report cost after each API call
- Orchestrator maintains running total, passes remaining budget downstream
- Tracked at run level AND aggregated monthly per user for billing

### Priority Ordering Rationale
Following tweets: highest relevance, lowest cost. Search: medium cost. Second-degree: highest cost. Running in this order with a shared budget ensures expensive sources only execute if budget remains.

## Scheduling & Triggers

### Scheduled Runs
- API route: `POST /api/discovery/cron`
- Called externally at midnight and noon (Vercel Cron, system crontab, or node-cron)
- Iterates over users with active scheduled configs
- Runs execute sequentially per user
- Protected by shared secret

### On-Demand Runs
- API route: `POST /api/discovery/run`
- Uses on-demand config (separate from scheduled config)
- Returns `runId` immediately, client polls for completion
- Guard: one active run per user at a time

### Rate Limit Safety
- Orchestrator checks X API rate limit headers on every response
- Pauses and retries after reset window on 429s (rather than burning budget)
- 5-minute timeout — saves partial results if exceeded

## X API Authentication

### Hybrid approach:
- **App-level bearer token** — used for public searches (trending, keyword search). No user OAuth needed.
- **User OAuth** — required for personalized sources (following list, timelines, second-degree). Each user connects their own X account.

### Multi-user token storage:
- Existing `lib/xapi/token-store.ts` needs to be keyed by `userId` instead of singleton
- Each user's OAuth tokens stored independently

## Discovery Inbox UI

### Page: `/discovery`
- Separate from main feed
- Shows pending `DiscoveryItem`s sorted by relevance score (highest first)
- Each card: tweet preview, author, relevance score, match reason tags
- Uses existing card components (tweet-card, thread-card) with discovery wrapper

### Actions Per Item
- **Save** — runs through existing ingest pipeline, creates real `Item`, marks DiscoveryItem as saved
- **Dismiss** — hidden from inbox, no further effect
- **Flag as irrelevant** — marks as irrelevant AND feeds back into relevance scoring

### Feedback Loop (`lib/discovery/feedback.ts`)
- Tracks irrelevant flags: associated keywords, categories, authors, embedding vectors
- Builds negative signal profile per user over time
- Relevance module penalizes new tweets similar to frequently-flagged content
- Implementation: store flagged tweet embeddings, compute similarity, apply penalty multiplier

### Run History
- Section on discovery page showing recent runs: timestamp, items found, cost
- Gives users visibility into spend

### Settings Integration
- New section in existing Settings page
- Two tabs: "Scheduled" and "On-Demand"
- Each tab: source toggles, budget slider, category picker, keyword input
- Estimated cost per run (rough, based on historical averages)

## Relevance Scoring Algorithm

### Signal Combination
Weighted sum of three signals, each normalized to 0.0-1.0:
- **Category match** (weight: 0.3) — 1.0 if tweet matches a selected category, 0.0 otherwise
- **Keyword hit** (weight: 0.3) — 1.0 if any keyword matches, 0.5 for partial/related matches
- **Semantic similarity** (weight: 0.4) — cosine similarity between tweet embedding and nearest saved item embedding (already 0.0-1.0 range from Gemini)

Final score = (category * 0.3) + (keyword * 0.3) + (semantic * 0.4) - penalty

### Negative Feedback Penalty
- Store embeddings of flagged-as-irrelevant tweets per user
- For each incoming tweet, compute max cosine similarity against flagged embeddings
- If similarity > 0.85: penalty = 0.3 (heavy penalty for very similar content)
- If similarity > 0.70: penalty = 0.15 (moderate)
- Otherwise: penalty = 0.0
- Weights and thresholds are configurable and should be tuned with real data

### Relevance Threshold
Default: 0.4 (user-configurable via `semanticMatchThreshold` in DiscoveryConfig). Tweets below this score are discarded.

## Multi-User Token Storage

Current `token-store.ts` is a singleton (uses `findFirst()` without userId filtering). For multi-user:
- Add `userId` foreign key to `XApiConnection` model
- Update `loadTokens(userId)` and `storeTokens(userId, ...)` signatures
- This is a prerequisite for multi-user discovery but NOT for single-user initial implementation
- Single-user phase: existing singleton works fine since there's only one user

## Error Handling & Edge Cases

- **Rate limited (429):** Pause until `x-rate-limit-reset` header time, max 3 retries per module, then save partial results
- **Auth failure (401/403):** Mark run as failed, notify user their OAuth token needs refresh
- **Budget exhausted mid-source:** Complete current pagination page, skip remaining sources, save what was found
- **Stale high-water marks:** If `since_id` returns zero results for 7 consecutive runs, reset the mark (user may have been unfollowed or tweets deleted)
- **Duplicate in both Item and DiscoveryItem:** Skip silently (already captured or already in inbox)
- **X API outage:** Mark run as failed with error, next scheduled run retries normally

## Multi-User & Monetization

### Subscription Tiers
- **Free** — limits TBD pending cost analysis from initial testing
- **Pro (~$10/mo)** — scheduled + on-demand, all sources, OAuth required, configurable
- **Power (~$25/mo)** — highest caps, overage credits included, priority scheduling

Tier specifics will be finalized after real-world cost data is gathered from single-user testing.

### Enforcement
- Tier limits checked when creating a run (source/frequency gates) and within orchestrator (budget cap)
- Monthly cap reached: runs stop with clear message + option for overage credits
- Overage credits: `creditBalanceCents` on User, deducted per run's actual cost

### Billing Integration (Deferred)
- Data model supports cost tracking now
- Actual payment processing (Stripe, etc.) is a later concern
- Current single-user usage provides real data for pricing tiers

### User Isolation
- All discovery data (runs, inbox, configs, high-water marks, feedback) scoped by `userId`
- No data leaks between users
