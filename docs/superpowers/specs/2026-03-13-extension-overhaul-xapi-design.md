# Extension Overhaul + xAPI Integration Design

## Problem Statement

The current browser extension has several capture quality issues:

1. **Articles captured as tweets** — only the first paragraph is captured; the `content_state` parser is fragile and depends on X's internal API structure
2. **No thread detection** — threads are captured as individual tweets with no grouping; the `conversation_id` field from X's API is available but unused
3. **No art prompt detection** — AI image/video prompts (Midjourney, DALL-E, Stable Diffusion, Sora, Runway) are all stored as plain tweets
4. **Branding** — still says "BaseX" everywhere, needs to be "FeedSilo"
5. **Account risk** — intercepting X's internal GraphQL API responses could theoretically trigger account flags

Additionally, the user wants an **optional xAPI (X API v2) integration** as a safer alternative for users who don't want to risk their accounts.

## Architecture Overview

Two independent capture methods feeding the same ingest pipeline:

```
┌─────────────────────┐     ┌─────────────────────┐
│  Browser Extension   │     │   xAPI Sync Engine   │
│  (intercept + save)  │     │  (OAuth 2.0 PKCE)    │
│                      │     │                      │
│  - Per-tweet buttons │     │  - Bookmarks sync    │
│  - Bulk capture      │     │  - Likes sync        │
│  - Live as-you-browse│     │  - Scheduled pulls   │
└──────────┬───────────┘     └──────────┬───────────┘
           │                            │
           ▼                            ▼
    ┌──────────────────────────────────────┐
    │        /api/extension/capture        │
    │        /api/extension/capture/bulk   │
    │                                      │
    │           ingestItem()               │
    │   (shared pipeline: dedup, index,    │
    │    embed, R2 download)               │
    └──────────────────────────────────────┘
```

---

## Part 1: Extension Overhaul

### 1.1 Source Type Detection

**Current state:** Extension sets `source_type` to either `"tweet"` or `"article"`. Server defaults to `"tweet"` for anything else.

**New detection logic in `cacheTweetData()`:**

```
1. Article detection (existing, keep):
   - tweet.article?.article_results?.result → "article"

2. Thread detection (NEW):
   - legacy.conversation_id !== tweet.rest_id → "thread"
   (A tweet whose conversation_id differs from its own ID is a reply in a thread)

3. Art prompt detection (NEW):
   - Scan body_text for AI tool patterns:
     - Midjourney: /--ar\s+\d+:\d+|--v\s+[\d.]+|--style\s+\w+|\/imagine\b/i
     - DALL-E: /\bdall[-·]?e\b/i
     - Stable Diffusion: /\bstable\s*diffusion\b|\bsdxl\b|\bcomfyui\b/i
     - Flux: /\bflux\b.*\b(pro|dev|schnell)\b/i
     - Image gen: /\b(generated|created)\s+(with|using|by)\s+(midjourney|dall-?e|stable.?diffusion|flux)/i
   - If image prompt detected AND has media → "image_prompt"
   - Video tools: /\b(sora|runway|pika|kling|hailuo)\b/i
   - If video prompt detected AND has video media → "video_prompt"

4. Default: "tweet"
```

**Where:** New function `detectSourceType(tweet, bodyText, mediaUrls)` in `content.js`, called from `cacheTweetData()`.

### 1.2 Thread Detection Enhancement

**Current state:** `isThreadReply()` exists but only for bulk capture skip logic (DOM-based).

**Enhancement:** Use the API-intercepted `conversation_id` to properly tag threads.

```javascript
// In cacheTweetData():
const conversationId = legacy.conversation_id || tweet.rest_id;
const isThread = conversationId !== tweet.rest_id;

// Add to cached data:
tweetCache.set(tweetId, {
  ...existingFields,
  conversation_id: conversationId,  // NEW: send to server
  source_type: detectSourceType(tweet, bodyText, mediaUrls, isThread, isArticle),
});
```

**Server-side:** Add `conversation_id` to `CapturePayload` and store it on `ContentItem`. This enables proper thread chain display on the detail page.

### 1.3 Article Capture Improvements

**Current issues:**
- `content_state` parsing depends on the full article body being in the initial GraphQL response
- Sometimes only `preview_text` is available
- The `resolveArticleContent()` in background.js only gets `preview_text` from syndication

**Fix strategy:**
1. Keep existing `content_state` parser (it works when data is present)
2. Improve syndication fallback: also extract `article.cover_image`, `article.text` fields
3. Add a retry mechanism: if article body is < 500 chars after initial capture, the save button shows "partial" state and the content script watches for the full content_state to arrive in subsequent API responses
4. Store `body_html` for articles (convert Draft.js blocks to HTML, not just markdown)

### 1.4 Rebranding BaseX → FeedSilo

All user-facing strings, CSS classes, console.log prefixes, and event names:
- `basex-api-response` → `feedsilo-api-response`
- `basex-save-btn` → `feedsilo-save-btn`
- `BaseX` console prefix → `FeedSilo`
- `BUTTON_ATTR = 'data-basex-btn'` → `'data-feedsilo-btn'`
- Popup: "Base**X**" → "Feed**Silo**"
- Manifest: name, description
- `#basex-hud` → `#feedsilo-hud`
- All CSS class prefixes

### 1.5 Capture Payload Enhancement

Add new fields to the payload sent to the server:

```typescript
interface CapturePayload {
  // Existing fields...
  external_id: string;
  source_url: string;
  source_type?: string;
  // ...

  // NEW fields:
  conversation_id?: string;     // Thread grouping
  quoted_tweet_id?: string;     // Quote tweet reference
  body_html?: string;           // Rich article body
  is_retweet?: boolean;         // Skip retweets in bulk capture
  bookmark_count?: number;      // X API provides this
}
```

Server-side changes:
- Add `conversation_id` column to `ContentItem` (nullable text)
- Update `ingestItem()` to store `conversation_id` and `body_html`
- Update Prisma schema

---

## Part 2: xAPI Integration

### 2.1 Why xAPI

| Aspect | Extension | xAPI |
|--------|-----------|------|
| Account risk | Medium (intercepts internal API) | Zero (official API) |
| Data quality | Depends on what's visible on page | Complete tweet objects with all fields |
| Media | Must resolve videos separately | Full media objects included |
| Threads | Must detect via conversation_id | Full conversation chain available |
| Cost | Free | $200/month Basic tier (15K reads) |
| Setup | Install extension | OAuth flow + API key |
| Capture mode | Manual (click/bulk) | Automated sync |

### 2.2 X API v2 Pricing Reality

- **Free tier**: Write-only (500 posts/month), cannot read tweets
- **Basic tier ($200/month)**: 15,000 tweet reads/month, 50,000 writes
- **Pro tier ($5,000/month)**: 1M reads, full archive
- **Pay-as-you-go**: New option (launched Feb 2026), usage-based pricing

For FeedSilo's use case (syncing bookmarks + likes), Basic tier at $200/month is sufficient. Users bring their own API credentials.

### 2.3 OAuth 2.0 PKCE Flow

```
User clicks "Connect X Account" in Settings
        │
        ▼
Server generates PKCE code_verifier + code_challenge
Redirects to: https://twitter.com/i/oauth2/authorize
  ?response_type=code
  &client_id=CLIENT_ID
  &redirect_uri=http://localhost:3000/api/xapi/callback
  &scope=tweet.read users.read bookmark.read like.read
  &state=RANDOM_STATE
  &code_challenge=CHALLENGE
  &code_challenge_method=S256
        │
        ▼
User authorizes on X
X redirects to /api/xapi/callback?code=AUTH_CODE&state=STATE
        │
        ▼
Server exchanges code for access_token + refresh_token
Stores encrypted tokens in DB
```

### 2.4 xAPI Endpoints

**Settings/Auth:**
- `GET /api/xapi/status` — Check if connected, token validity
- `GET /api/xapi/authorize` — Start OAuth flow (redirect)
- `GET /api/xapi/callback` — OAuth callback, store tokens
- `POST /api/xapi/disconnect` — Revoke tokens, remove from DB

**Sync:**
- `POST /api/xapi/sync/bookmarks` — Pull bookmarks, ingest new ones
- `POST /api/xapi/sync/likes` — Pull liked tweets, ingest new ones

### 2.5 Data Mapping: X API v2 → CapturePayload

```typescript
function xApiTweetToCapturePayload(tweet, includes): CapturePayload {
  const author = includes.users.find(u => u.id === tweet.author_id);
  const media = tweet.attachments?.media_keys?.map(
    key => includes.media.find(m => m.media_key === key)
  ).filter(Boolean);

  return {
    external_id: tweet.id,
    source_url: `https://x.com/${author.username}/status/${tweet.id}`,
    source_type: detectSourceTypeFromApiV2(tweet),
    author_handle: author?.username,
    author_display_name: author?.name,
    author_avatar_url: author?.profile_image_url?.replace('_normal', '_400x400'),
    title: null, // Articles handled separately
    body_text: tweet.text,
    posted_at: tweet.created_at,
    media_urls: media?.map(m => m.url || m.preview_image_url),
    conversation_id: tweet.conversation_id,
    likes: tweet.public_metrics?.like_count,
    retweets: tweet.public_metrics?.retweet_count,
    replies: tweet.public_metrics?.reply_count,
    views: tweet.public_metrics?.impression_count,
    bookmark_count: tweet.public_metrics?.bookmark_count,
  };
}
```

### 2.6 Sync Logic

```
POST /api/xapi/sync/bookmarks
  1. Load access_token from DB
  2. GET https://api.x.com/2/users/:id/bookmarks
     ?tweet.fields=created_at,public_metrics,conversation_id,entities,note_tweet
     &expansions=author_id,attachments.media_keys
     &user.fields=name,username,profile_image_url
     &media.fields=url,preview_image_url,type,variants
     &max_results=100
  3. For each tweet:
     a. Check if external_id already exists (dedup)
     b. Map to CapturePayload
     c. Call ingestItem()
  4. Paginate using next_token until no more results
  5. Return { synced: N, skipped: M, errors: E }
```

Rate limit: 180 requests per 15 minutes per user. Each request returns up to 100 tweets. So max ~18,000 bookmarks per 15 minutes — more than enough for initial sync plus incremental pulls.

### 2.7 Settings UI

Add a new section to the existing Settings page:

```
┌─────────────────────────────────────────┐
│ X API Integration (Optional)            │
│                                         │
│ ⚠️  The browser extension intercepts    │
│ X's internal API. While thousands use   │
│ this approach safely, it technically    │
│ violates X's ToS. For zero account     │
│ risk, connect via the official X API.  │
│                                         │
│ Status: ⚫ Not connected                │
│                                         │
│ [Connect X Account]                     │
│                                         │
│ Requires X API Basic plan ($200/month)  │
│ You'll need: API Key, API Secret,       │
│ Client ID from developer.x.com          │
│                                         │
│ ─────────────────────────────────────── │
│ API Credentials                         │
│ Client ID:     [________________]       │
│ Client Secret: [________________]       │
│                                         │
│ [Save & Connect]                        │
│                                         │
│ ─────────────────────────────────────── │
│ Sync                                    │
│ [Sync Bookmarks]  [Sync Likes]          │
│ Last sync: Never                        │
└─────────────────────────────────────────┘
```

### 2.8 Token Storage

Store encrypted OAuth tokens in a new DB table:

```prisma
model XApiConnection {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  x_user_id       String   @unique @db.Text
  x_username      String   @db.Text
  access_token    String   @db.Text  // encrypted at rest
  refresh_token   String   @db.Text  // encrypted at rest
  token_expires_at DateTime @db.Timestamptz(6)
  scopes          String   @db.Text
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @updatedAt @db.Timestamptz(6)

  @@map("xapi_connections")
}
```

Encryption: AES-256-GCM using `XAPI_ENCRYPTION_KEY` env var.

---

## Part 3: Database Changes

### 3.1 Schema Additions

```sql
-- Add conversation_id to content_items
ALTER TABLE content_items ADD COLUMN conversation_id TEXT;
CREATE INDEX ix_content_items_conversation_id ON content_items(conversation_id);

-- Add xapi_connections table
CREATE TABLE xapi_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  x_user_id TEXT UNIQUE NOT NULL,
  x_username TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 Prisma Schema Updates

Add `conversation_id` to `ContentItem` model and add `XApiConnection` model.

---

## Implementation Priority

### Phase 1: Extension Quality Fixes (immediate)
1. Add `detectSourceType()` function with thread/art prompt detection
2. Pass `conversation_id` through the pipeline
3. Improve article content_state reliability
4. Rebrand BaseX → FeedSilo

### Phase 2: Server-Side Preparation
5. Add `conversation_id` column + migration
6. Update `CapturePayload` type and `ingestItem()`
7. Update Prisma schema

### Phase 3: xAPI Integration
8. Add `XApiConnection` model + migration
9. Implement OAuth 2.0 PKCE flow
10. Implement bookmarks/likes sync endpoints
11. Add xAPI settings section to Settings page
12. Add warning copy about extension vs xAPI

---

## Files to Create

```
lib/xapi/
  client.ts          — X API v2 HTTP client (tweet lookup, bookmarks, likes)
  oauth.ts           — PKCE flow helpers (authorize URL, token exchange, refresh)
  token-store.ts     — Encrypt/decrypt/store/load tokens
  mapper.ts          — X API v2 tweet → CapturePayload mapping

app/api/xapi/
  status/route.ts    — Check connection status
  authorize/route.ts — Start OAuth flow
  callback/route.ts  — OAuth callback handler
  disconnect/route.ts — Revoke + delete tokens
  sync/
    bookmarks/route.ts — Sync bookmarks
    likes/route.ts     — Sync likes
```

## Files to Modify

```
extension/manifest.json        — Rebrand name/description
extension/interceptor.js       — Rename event, clean up debug logs
extension/content.js           — Add detectSourceType(), conversation_id, rebrand
extension/background.js        — Rebrand console logs
extension/popup.html           — Rebrand UI
extension/popup.js             — No logic changes needed
extension/content.css          — Rename CSS classes

prisma/schema.prisma           — Add conversation_id, XApiConnection
lib/db/types.ts                — Update CapturePayload
lib/ingest/index.ts            — Store conversation_id, body_html
app/settings/                  — Add xAPI settings section
```

## Key Risks

1. **X API pricing** — $200/month Basic tier may be too expensive for some users. Pay-as-you-go option exists but pricing details unclear.
2. **Art prompt detection** — Regex-based detection will have false positives/negatives. Can be refined over time with user feedback.
3. **Thread grouping accuracy** — `conversation_id` from X API is reliable. The extension-intercepted data should also have it in `legacy.conversation_id`.
4. **Token security** — OAuth tokens stored server-side need encryption. Single-user app reduces attack surface.
