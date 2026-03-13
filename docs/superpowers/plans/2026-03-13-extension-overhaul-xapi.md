# Extension Overhaul + xAPI Integration — Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix extension capture quality (source type detection, threads, articles), rebrand BaseX → FeedSilo, and add optional X API v2 integration as a safer capture method.

**Architecture:** Two independent capture paths (browser extension + xAPI sync) feeding the same `ingestItem()` pipeline. Extension fixes are client-side JS changes. xAPI is a new server-side module with OAuth 2.0 PKCE.

**Tech Stack:** Chrome Extension (Manifest V3), Next.js API routes, X API v2, OAuth 2.0 PKCE, Prisma, PostgreSQL

---

## Chunk 1: Extension Source Type Detection + Conversation ID

### Task 1: Add `detectSourceType()` to content.js

**Files:**
- Modify: `extension/content.js` (lines 223-341, `cacheTweetData` function)

- [ ] **Step 1: Add detectSourceType function**

Add this function before `cacheTweetData()`:

```javascript
function detectSourceType(tweet, bodyText, mediaUrls, isArticle) {
  if (isArticle) return 'article';

  // Thread: conversation_id differs from tweet's own ID
  const legacy = tweet.legacy || {};
  const conversationId = legacy.conversation_id || tweet.rest_id;
  if (conversationId && conversationId !== tweet.rest_id) return 'thread';

  // Art prompt detection (only if tweet has media)
  if (mediaUrls.length > 0 && bodyText) {
    const text = bodyText.toLowerCase();

    // Midjourney patterns
    if (/--ar\s+\d+:\d+/.test(text) || /--v\s+[\d.]+/.test(text) ||
        /--style\s+\w+/.test(text) || /\/imagine\b/.test(text) ||
        /\bmidjourney\b/.test(text)) {
      return 'image_prompt';
    }

    // DALL-E
    if (/\bdall[-·\s]?e\b/i.test(bodyText)) return 'image_prompt';

    // Stable Diffusion / SDXL / ComfyUI
    if (/\bstable\s*diffusion\b/i.test(bodyText) || /\bsdxl\b/i.test(bodyText) ||
        /\bcomfyui\b/i.test(bodyText)) {
      return 'image_prompt';
    }

    // Flux
    if (/\bflux\b/i.test(bodyText) && /\b(pro|dev|schnell|1\.1)\b/i.test(bodyText)) {
      return 'image_prompt';
    }

    // Generic "generated with/using/by [tool]"
    if (/\b(generated|created|made)\s+(with|using|by|in)\s+(midjourney|dall-?e|stable.?diffusion|flux|leonardo|firefly)/i.test(bodyText)) {
      return 'image_prompt';
    }

    // Video generation tools
    const videoTools = /\b(sora|runway|pika|kling|hailuo|luma\s*dream\s*machine)\b/i;
    if (videoTools.test(bodyText)) {
      const hasVideo = mediaUrls.some(u => u.includes('.mp4') || u.includes('video'));
      return hasVideo ? 'video_prompt' : 'image_prompt';
    }
  }

  return 'tweet';
}
```

- [ ] **Step 2: Wire detectSourceType into cacheTweetData**

In `cacheTweetData()`, replace the existing source_type assignment:

```javascript
// BEFORE (around line 327):
// source_type: isArticle ? 'article' : 'tweet',

// AFTER:
const conversationId = legacy.conversation_id || tweet.rest_id;
// ...later in tweetCache.set():
source_type: detectSourceType(tweet, bodyText, mediaUrls, isArticle),
conversation_id: conversationId,
```

Add `conversation_id` to the object stored in tweetCache and sent to the server.

- [ ] **Step 3: Update extractTweetFromDOM fallback to include conversation_id**

In `extractTweetFromDOM()`, add `conversation_id: null` to the DOM-extracted fallback object.

- [ ] **Step 4: Test locally**

Load the extension in Chrome, navigate to X, verify:
- Regular tweets → `source_type: "tweet"`
- Thread replies → `source_type: "thread"`
- Tweets with Midjourney prompts + images → `source_type: "image_prompt"`
- Articles → `source_type: "article"` (unchanged)

---

### Task 2: Update server to accept conversation_id

**Files:**
- Modify: `lib/db/types.ts`
- Modify: `lib/ingest/index.ts`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add conversation_id to CapturePayload**

In `lib/db/types.ts`, add to `CapturePayload`:

```typescript
conversation_id?: string | null;
body_html?: string | null;
```

- [ ] **Step 2: Add conversation_id to Prisma schema**

In `prisma/schema.prisma`, add to `ContentItem`:

```prisma
conversation_id     String?          @db.Text
```

Add index:

```prisma
@@index([conversation_id], map: "ix_content_items_conversation_id")
```

- [ ] **Step 3: Run Prisma migration**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 4: Update ingestItem to store conversation_id**

In `lib/ingest/index.ts`, add to the `prisma.contentItem.create()` data:

```typescript
conversation_id: payload.conversation_id || null,
body_html: payload.body_html || null,
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

---

## Chunk 2: Article Capture Improvements

### Task 3: Improve article body extraction reliability

**Files:**
- Modify: `extension/content.js` (formatContentStateBlocks, cacheTweetData)

- [ ] **Step 1: Add content_state arrival watcher**

After `cacheTweetData()`, add logic to the `extractTweetsFromApiResponse` to better match late-arriving `content_state` data to cached articles:

```javascript
// In extractTweetsFromApiResponse, existing content_state check (line 41-59):
// Improve the matching logic — don't require substring match,
// instead match by checking if any cached article was captured within
// the last 30 seconds and has a short body
if (data.content_state?.blocks?.length > 0) {
  const { body: fullBody, imageUrls } = formatContentStateBlocks(data.content_state);
  if (fullBody.length > 200) {
    // Find the most recent article in cache with short body
    let bestMatch = null;
    let bestTime = 0;
    for (const [id, cached] of tweetCache) {
      if (cached.source_type === 'article' && cached._cachedAt > bestTime) {
        if (!cached.body_text || cached.body_text.length < fullBody.length) {
          bestMatch = { id, cached };
          bestTime = cached._cachedAt;
        }
      }
    }
    if (bestMatch && (Date.now() - bestTime) < 60000) {
      bestMatch.cached.body_text = fullBody;
      for (const imgUrl of imageUrls) {
        if (!bestMatch.cached.media_urls.includes(imgUrl)) {
          bestMatch.cached.media_urls.push(imgUrl);
        }
      }
    }
  }
}
```

- [ ] **Step 2: Add _cachedAt timestamp to tweetCache entries**

In `cacheTweetData()`, add `_cachedAt: Date.now()` to the cached object.

- [ ] **Step 3: Strip internal fields before sending to server**

In `extractTweetFromDOM()`, before returning cached data, strip internal fields:

```javascript
const data = { ...tweetCache.get(tweetId) };
delete data._hasUnresolvedVideo;
delete data._cachedAt;
return data;
```

- [ ] **Step 4: Improve background.js syndication article resolution**

In `background.js`, `resolveArticleContent()`: also extract `article.cover_image` and more fields from syndication response.

---

### Task 4: Reduce debug logging noise

**Files:**
- Modify: `extension/content.js`
- Modify: `extension/interceptor.js`

- [ ] **Step 1: Remove or gate verbose debug logging**

Wrap all `console.log('BaseX:` / `FeedSilo:` calls in a debug flag:

```javascript
const DEBUG = false; // Set to true for development
function log(...args) { if (DEBUG) console.log('FeedSilo:', ...args); }
```

Replace all `console.log('BaseX:` with `log(` calls.

- [ ] **Step 2: Remove debugContentState from interceptor.js**

Delete the `debugContentState()` function and its calls.

---

## Chunk 3: Rebrand BaseX → FeedSilo

### Task 5: Rebrand extension

**Files:**
- Modify: `extension/manifest.json`
- Modify: `extension/interceptor.js`
- Modify: `extension/content.js`
- Modify: `extension/content.css`
- Modify: `extension/background.js`
- Modify: `extension/popup.html`
- Modify: `extension/popup.js`

- [ ] **Step 1: Update manifest.json**

```json
{
  "name": "FeedSilo Capture",
  "description": "Capture tweets, threads, and articles from X/Twitter to your FeedSilo knowledge base."
}
```

- [ ] **Step 2: Rename custom event in interceptor.js**

Replace `basex-api-response` → `feedsilo-api-response`.

- [ ] **Step 3: Rename event listener in content.js**

Replace `basex-api-response` → `feedsilo-api-response`.

- [ ] **Step 4: Rename CSS classes and IDs**

In `content.css`:
- `.basex-save-btn` → `.feedsilo-save-btn`
- `#basex-hud` → `#feedsilo-hud`
- `.basex-hud-header` → `.feedsilo-hud-header`
- `#basex-hud-stop` → `#feedsilo-hud-stop`
- `.basex-hud-stats` → `.feedsilo-hud-stats`

In `content.js`:
- `BUTTON_ATTR = 'data-basex-btn'` → `'data-feedsilo-btn'`
- All references to `basex-save-btn` → `feedsilo-save-btn`
- All references to `basex-hud` → `feedsilo-hud`
- `#basex-hud-stop` → `#feedsilo-hud-stop`
- `basex-stat-*` → `feedsilo-stat-*`

- [ ] **Step 5: Update popup.html branding**

Replace `Base<em>X</em>` with `Feed<em>Silo</em>`.

- [ ] **Step 6: Update console.log prefixes in background.js**

Replace `BaseX:` → `FeedSilo:` in all console.log/warn/error calls.

- [ ] **Step 7: Verify extension loads and works**

Reload extension in Chrome, verify save buttons appear and captures work.

- [ ] **Step 8: Commit**

```bash
git add extension/
git commit -m "refactor: rebrand extension BaseX → FeedSilo + add source type detection"
```

---

## Chunk 4: xAPI Foundation — OAuth + Token Storage

### Task 6: Add XApiConnection to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add XApiConnection model**

```prisma
model XApiConnection {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  x_user_id        String   @unique @db.Text
  x_username       String   @db.Text
  access_token_enc String   @db.Text
  refresh_token_enc String  @db.Text
  token_expires_at DateTime @db.Timestamptz(6)
  scopes           String   @db.Text
  created_at       DateTime @default(now()) @db.Timestamptz(6)
  updated_at       DateTime @default(now()) @updatedAt @db.Timestamptz(6)

  @@map("xapi_connections")
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma db push
npx prisma generate
```

---

### Task 7: Create token encryption utilities

**Files:**
- Create: `lib/xapi/token-store.ts`

- [ ] **Step 1: Write encryption/decryption helpers**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const key = process.env.XAPI_ENCRYPTION_KEY;
  if (!key) throw new Error('XAPI_ENCRYPTION_KEY not set');
  return Buffer.from(key, 'hex'); // 32-byte hex string
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decrypt(data: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, encrypted] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

- [ ] **Step 2: Add store/load functions**

```typescript
import { getClient } from '@/lib/db/client';

export async function storeTokens(data: {
  xUserId: string;
  xUsername: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string;
}): Promise<void> {
  const prisma = await getClient();
  await prisma.xApiConnection.upsert({
    where: { x_user_id: data.xUserId },
    create: {
      x_user_id: data.xUserId,
      x_username: data.xUsername,
      access_token_enc: encrypt(data.accessToken),
      refresh_token_enc: encrypt(data.refreshToken),
      token_expires_at: data.expiresAt,
      scopes: data.scopes,
    },
    update: {
      x_username: data.xUsername,
      access_token_enc: encrypt(data.accessToken),
      refresh_token_enc: encrypt(data.refreshToken),
      token_expires_at: data.expiresAt,
      scopes: data.scopes,
    },
  });
}

export async function loadTokens(): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  xUserId: string;
  xUsername: string;
} | null> {
  const prisma = await getClient();
  const conn = await prisma.xApiConnection.findFirst();
  if (!conn) return null;
  return {
    accessToken: decrypt(conn.access_token_enc),
    refreshToken: decrypt(conn.refresh_token_enc),
    expiresAt: conn.token_expires_at,
    xUserId: conn.x_user_id,
    xUsername: conn.x_username,
  };
}

export async function deleteTokens(): Promise<void> {
  const prisma = await getClient();
  await prisma.xApiConnection.deleteMany();
}
```

---

### Task 8: Create OAuth 2.0 PKCE helpers

**Files:**
- Create: `lib/xapi/oauth.ts`

- [ ] **Step 1: Write PKCE challenge generation**

```typescript
import { randomBytes, createHash } from 'crypto';

export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}): string {
  const url = new URL('https://twitter.com/i/oauth2/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', 'tweet.read users.read bookmark.read like.read offline.access');
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const resp = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      code: params.code,
      grant_type: 'authorization_code',
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed: ${resp.status} ${text}`);
  }

  return resp.json();
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const resp = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${params.clientId}:${params.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      refresh_token: params.refreshToken,
      grant_type: 'refresh_token',
      client_id: params.clientId,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token refresh failed: ${resp.status} ${text}`);
  }

  return resp.json();
}
```

---

### Task 9: Create X API v2 client

**Files:**
- Create: `lib/xapi/client.ts`

- [ ] **Step 1: Write API client with auto-refresh**

```typescript
import { loadTokens, storeTokens } from './token-store';
import { refreshAccessToken } from './oauth';

const BASE_URL = 'https://api.x.com/2';

async function getAccessToken(): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) throw new Error('No X API connection. Connect via Settings.');

  // Refresh if expired or expiring within 5 minutes
  if (tokens.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const clientId = process.env.XAPI_CLIENT_ID;
    const clientSecret = process.env.XAPI_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('XAPI_CLIENT_ID/SECRET not set');

    const refreshed = await refreshAccessToken({
      refreshToken: tokens.refreshToken,
      clientId,
      clientSecret,
    });

    await storeTokens({
      xUserId: tokens.xUserId,
      xUsername: tokens.xUsername,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      scopes: 'tweet.read users.read bookmark.read like.read offline.access',
    });

    return refreshed.access_token;
  }

  return tokens.accessToken;
}

export async function xApiFetch(path: string, params?: Record<string, string>): Promise<any> {
  const token = await getAccessToken();
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`X API error: ${resp.status} ${text}`);
  }

  return resp.json();
}

const TWEET_FIELDS = 'created_at,public_metrics,conversation_id,entities,note_tweet,attachments';
const USER_FIELDS = 'name,username,profile_image_url';
const MEDIA_FIELDS = 'url,preview_image_url,type,variants,alt_text';
const EXPANSIONS = 'author_id,attachments.media_keys';

export async function fetchBookmarks(paginationToken?: string): Promise<any> {
  const tokens = await loadTokens();
  if (!tokens) throw new Error('Not connected');

  const params: Record<string, string> = {
    'tweet.fields': TWEET_FIELDS,
    'user.fields': USER_FIELDS,
    'media.fields': MEDIA_FIELDS,
    expansions: EXPANSIONS,
    max_results: '100',
  };
  if (paginationToken) params.pagination_token = paginationToken;

  return xApiFetch(`/users/${tokens.xUserId}/bookmarks`, params);
}

export async function fetchLikedTweets(paginationToken?: string): Promise<any> {
  const tokens = await loadTokens();
  if (!tokens) throw new Error('Not connected');

  const params: Record<string, string> = {
    'tweet.fields': TWEET_FIELDS,
    'user.fields': USER_FIELDS,
    'media.fields': MEDIA_FIELDS,
    expansions: EXPANSIONS,
    max_results: '100',
  };
  if (paginationToken) params.pagination_token = paginationToken;

  return xApiFetch(`/users/${tokens.xUserId}/liked_tweets`, params);
}
```

---

### Task 10: Create tweet-to-payload mapper

**Files:**
- Create: `lib/xapi/mapper.ts`

- [ ] **Step 1: Write mapping function**

```typescript
import type { CapturePayload } from '@/lib/db/types';

interface XApiTweet {
  id: string;
  text: string;
  author_id: string;
  created_at?: string;
  conversation_id?: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    impression_count: number;
    bookmark_count: number;
  };
  attachments?: { media_keys?: string[] };
  note_tweet?: { text: string };
}

interface XApiUser {
  id: string;
  username: string;
  name: string;
  profile_image_url?: string;
}

interface XApiMedia {
  media_key: string;
  type: string;
  url?: string;
  preview_image_url?: string;
  variants?: Array<{ content_type: string; url: string; bit_rate?: number }>;
  alt_text?: string;
}

function detectSourceTypeFromApi(tweet: XApiTweet, mediaUrls: string[]): string {
  // Thread detection
  if (tweet.conversation_id && tweet.conversation_id !== tweet.id) return 'thread';

  const bodyText = tweet.note_tweet?.text || tweet.text;

  // Art prompt detection (same logic as extension)
  if (mediaUrls.length > 0 && bodyText) {
    const text = bodyText.toLowerCase();
    if (/--ar\s+\d+:\d+/.test(text) || /\/imagine\b/.test(text) || /\bmidjourney\b/.test(text)) return 'image_prompt';
    if (/\bdall[-·\s]?e\b/i.test(bodyText)) return 'image_prompt';
    if (/\bstable\s*diffusion\b/i.test(bodyText) || /\bsdxl\b/i.test(bodyText)) return 'image_prompt';
    if (/\bflux\b/i.test(bodyText) && /\b(pro|dev|schnell)\b/i.test(bodyText)) return 'image_prompt';
    if (/\b(sora|runway|pika|kling)\b/i.test(bodyText)) {
      const hasVideo = mediaUrls.some(u => u.includes('.mp4'));
      return hasVideo ? 'video_prompt' : 'image_prompt';
    }
  }

  return 'tweet';
}

export function mapTweetToPayload(
  tweet: XApiTweet,
  users: XApiUser[],
  media: XApiMedia[]
): CapturePayload {
  const author = users.find(u => u.id === tweet.author_id);

  // Resolve media URLs
  const mediaUrls: string[] = [];
  if (tweet.attachments?.media_keys) {
    for (const key of tweet.attachments.media_keys) {
      const m = media.find(item => item.media_key === key);
      if (!m) continue;
      if (m.type === 'video' || m.type === 'animated_gif') {
        const mp4s = (m.variants || [])
          .filter(v => v.content_type === 'video/mp4' && v.url)
          .sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0));
        if (mp4s[0]) mediaUrls.push(mp4s[0].url);
        else if (m.preview_image_url) mediaUrls.push(m.preview_image_url);
      } else {
        if (m.url) mediaUrls.push(m.url);
        else if (m.preview_image_url) mediaUrls.push(m.preview_image_url);
      }
    }
  }

  const bodyText = tweet.note_tweet?.text || tweet.text;

  return {
    external_id: tweet.id,
    source_url: author
      ? `https://x.com/${author.username}/status/${tweet.id}`
      : `https://x.com/i/web/status/${tweet.id}`,
    source_type: detectSourceTypeFromApi(tweet, mediaUrls),
    author_handle: author?.username || null,
    author_display_name: author?.name || null,
    author_avatar_url: author?.profile_image_url?.replace('_normal', '_400x400') || null,
    title: null,
    body_text: bodyText,
    posted_at: tweet.created_at || null,
    media_urls: mediaUrls,
    conversation_id: tweet.conversation_id || null,
    likes: tweet.public_metrics?.like_count ?? null,
    retweets: tweet.public_metrics?.retweet_count ?? null,
    replies: tweet.public_metrics?.reply_count ?? null,
    views: tweet.public_metrics?.impression_count ?? null,
  };
}
```

---

## Chunk 5: xAPI Sync Endpoints

### Task 11: Create OAuth API routes

**Files:**
- Create: `app/api/xapi/status/route.ts`
- Create: `app/api/xapi/authorize/route.ts`
- Create: `app/api/xapi/callback/route.ts`
- Create: `app/api/xapi/disconnect/route.ts`

- [ ] **Step 1: Status endpoint**

```typescript
// app/api/xapi/status/route.ts
import { NextResponse } from 'next/server';
import { loadTokens } from '@/lib/xapi/token-store';

export async function GET() {
  try {
    const tokens = await loadTokens();
    if (!tokens) {
      return NextResponse.json({ connected: false });
    }
    return NextResponse.json({
      connected: true,
      username: tokens.xUsername,
      expires_at: tokens.expiresAt.toISOString(),
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
```

- [ ] **Step 2: Authorize endpoint**

Generates PKCE challenge, stores code_verifier in a cookie, redirects to X.

- [ ] **Step 3: Callback endpoint**

Exchanges authorization code for tokens, fetches user info, stores encrypted tokens.

- [ ] **Step 4: Disconnect endpoint**

Deletes stored tokens.

---

### Task 12: Create sync endpoints

**Files:**
- Create: `app/api/xapi/sync/bookmarks/route.ts`
- Create: `app/api/xapi/sync/likes/route.ts`

- [ ] **Step 1: Bookmarks sync endpoint**

```typescript
// app/api/xapi/sync/bookmarks/route.ts
import { NextResponse } from 'next/server';
import { fetchBookmarks } from '@/lib/xapi/client';
import { mapTweetToPayload } from '@/lib/xapi/mapper';
import { ingestItem } from '@/lib/ingest';

export async function POST() {
  let synced = 0, skipped = 0, errors = 0;
  let paginationToken: string | undefined;

  try {
    do {
      const data = await fetchBookmarks(paginationToken);
      const tweets = data.data || [];
      const users = data.includes?.users || [];
      const media = data.includes?.media || [];

      for (const tweet of tweets) {
        try {
          const payload = mapTweetToPayload(tweet, users, media);
          const result = await ingestItem(payload);
          if (result.already_exists) skipped++;
          else synced++;
        } catch {
          errors++;
        }
      }

      paginationToken = data.meta?.next_token;
    } while (paginationToken);

    return NextResponse.json({ success: true, synced, skipped, errors });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Likes sync endpoint**

Same pattern as bookmarks but using `fetchLikedTweets()`.

- [ ] **Step 3: Commit**

```bash
git add lib/xapi/ app/api/xapi/ prisma/schema.prisma lib/db/types.ts lib/ingest/index.ts
git commit -m "feat: add X API v2 integration with OAuth PKCE + bookmarks/likes sync"
```

---

## Chunk 6: Settings UI for xAPI

### Task 13: Add xAPI section to Settings page

**Files:**
- Modify: Settings page component (TBD based on existing settings structure)

- [ ] **Step 1: Add xAPI connection status card**

Show connection status, username if connected, warning about extension vs API.

- [ ] **Step 2: Add API credentials form**

Client ID, Client Secret inputs, Save & Connect button.

- [ ] **Step 3: Add sync buttons**

Sync Bookmarks, Sync Likes buttons with last sync timestamp display.

- [ ] **Step 4: Add warning banner**

```
⚠️ The browser extension intercepts X's internal API responses. While widely
used, this technically violates X's Terms of Service. For zero account risk,
connect via the official X API instead. Requires X API Basic plan ($200/month).
```

---

## Chunk 7: Verification

### Task 14: End-to-end verification

- [ ] **Step 1: Test extension capture**
  - Capture a regular tweet → verify `source_type: "tweet"`
  - Capture a thread reply → verify `source_type: "thread"` with `conversation_id`
  - Capture an AI art tweet with Midjourney prompt → verify `source_type: "image_prompt"`
  - Capture an article → verify `source_type: "article"` with full body
  - Bulk capture a page of likes → verify mixed types detected correctly

- [ ] **Step 2: Test xAPI sync (if API credentials available)**
  - Connect via OAuth → verify token stored
  - Sync bookmarks → verify items ingested with correct types
  - Sync likes → verify items ingested
  - Verify deduplication (items captured by extension not re-imported)

- [ ] **Step 3: Build verification**

```bash
npm run build
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: extension overhaul + xAPI integration complete"
```
