# Cloudflare R2 Media Storage — Design Spec

## Goal

Download and store captured media (images, videos, GIFs) in Cloudflare R2 instead of relying on ephemeral third-party CDN URLs (e.g. `pbs.twimg.com`). R2 is optional — the app works without it, falling back to CDN URLs as it does today.

## Architecture

Media download is fire-and-forget during capture — `ingestItem()` returns immediately, and R2 upload happens in the background (same pattern as embedding generation). When R2 is configured, each media URL is fetched, uploaded to R2, and `stored_path` is updated. If R2 is not configured or download fails, `stored_path` stays NULL and the frontend falls back to `original_url`.

A one-time backfill SSE endpoint lets users download existing media to R2 after initial setup.

## Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| R2 client library | `@aws-sdk/client-s3` | R2 is S3-compatible; this is the standard SDK |
| Download timing | Background after ingest (fire-and-forget) | Consistent with existing embedding/indexing pattern; doesn't block extension response |
| Media record creation | Individual `create` calls (not `createMany`) | Need returned IDs for R2 key naming and `stored_path` update |
| Configuration | Env vars only | Matches Dokploy deployment pattern; no config file changes |
| Media serving | Direct R2 public URL | No proxy needed; Cloudflare CDN handles delivery |
| Fallback | Graceful (`stored_path \|\| original_url`) | Already implemented in all frontend components |
| Avatar handling | Skip (CDN URLs only) | Small files, rarely expire, not worth the complexity |
| Image resizing | Skip | R2 + Cloudflare CDN is fast enough for a personal tool |

## Environment Variables

All optional. If any are missing, R2 is disabled and the app works as before.

| Variable | Description | Example |
|----------|-------------|---------|
| `R2_ACCOUNT_ID` | Cloudflare account ID | `abc123def456` |
| `R2_ACCESS_KEY_ID` | R2 API token access key | `your-access-key` |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key | `your-secret-key` |
| `R2_BUCKET_NAME` | R2 bucket name | `feedsilo-media` |
| `R2_PUBLIC_URL` | Public bucket URL or custom domain | `https://pub-xxx.r2.dev` |

## Components

### 1. R2 Client (`lib/storage/r2.ts`)

Thin wrapper around `@aws-sdk/client-s3`.

- `isR2Configured(): boolean` — checks all 5 env vars are present
- `uploadMedia(key: string, body: Buffer, contentType: string): Promise<string>` — uploads to R2, returns public URL (`R2_PUBLIC_URL/key`)
- `deleteMedia(key: string): Promise<void>` — deletes from R2

R2 endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

Key naming convention: `media/{contentItemId}/{mediaId}.{ext}`

### 2. Media Download Helper (`lib/storage/download.ts`)

- `downloadAndStoreMedia(mediaId: string, contentItemId: string, originalUrl: string): Promise<string | null>` — fetches URL, detects content type, uploads to R2, returns public URL or null on failure
- Handles content-type detection from response headers
- Extracts file extension from URL or content-type
- Timeout: 30 seconds per download
- Max file size: 50MB (skip larger files)

### 3. Ingest Changes (`lib/ingest/index.ts`)

Refactor media creation from `createMany` to individual `create` calls so we get back the record IDs.

After creating each Media record and returning the ingest response:
1. Fire-and-forget: if `isR2Configured()`, call `downloadAndStoreMedia()` for each media record in the background (same pattern as `indexItemInBackground()`)
2. If download succeeds, update the Media record's `stored_path`
3. If download fails, log and continue — `stored_path` stays NULL

No changes to `CapturePayload` or browser extension.

### 4. Backfill Endpoint (`app/api/media/backfill/route.ts`)

GET endpoint, SSE stream (same pattern as `/api/search/reindex` and `/api/embeddings/generate-missing`).

1. Query all Media records where `stored_path IS NULL`
2. For each: download from `original_url`, upload to R2, update `stored_path`
3. Stream progress matching existing SSE shape: `{ progress: 0-1 float, processed, total, current, done: boolean, error?: string }`
4. Skip failures gracefully (expired URLs stay NULL, increment processed, continue)

### 5. Settings Page Addition

Modify `app/api/settings/route.ts` GET response to include:
```json
{
  "r2": {
    "configured": true,
    "mediaWithStored": 142,
    "mediaWithoutStored": 58
  }
}
```

These counts come from two simple queries: `prisma.media.count({ where: { stored_path: { not: null } } })` and `prisma.media.count({ where: { stored_path: null } })`.

Modify `components/settings/sections/data-section.tsx`:
- Accept new `r2` prop (from settings API response)
- When `r2.configured` is true, show "Media Storage" subsection with:
  - Status line: "58 of 200 media items pending download"
  - "Download Media to R2" button with existing `ProgressBar` component
- When `r2.configured` is false, show nothing (or a subtle "R2 not configured" hint)

### 6. Fix Broken `/api/media` Reference

In `app/api/items/route.ts`, the **offset-pagination branch only** (line 65) returns `url: /api/media/${id}` — a route that doesn't exist. Change to `url: stored_path || original_url`. The `excludeIds` branch already returns raw media objects from `fetchItems()` and is correct as-is.

## Files

### Create
- `lib/storage/r2.ts` — R2 client wrapper
- `lib/storage/download.ts` — download + upload helper
- `app/api/media/backfill/route.ts` — SSE backfill endpoint

### Modify
- `lib/ingest/index.ts` — switch to individual `create` calls, add background R2 download
- `app/api/items/route.ts` — fix `media_preview.url` in offset-pagination branch to use `stored_path || original_url`
- `app/api/settings/route.ts` — add `r2` field to GET response (configured status + media counts)
- `components/settings/sections/data-section.tsx` — add `r2` prop, media backfill button + ProgressBar
- `.env.example` — add R2 env vars (commented out, in optional section)
- `README.md` — add R2 setup instructions
- `package.json` — add `@aws-sdk/client-s3` dependency

### No Changes Needed
- Frontend display components — already use `stored_path || original_url`. Note: `optimizeXImageUrl()` only transforms `pbs.twimg.com` URLs, so R2 URLs pass through unchanged (correct behavior).
- Prisma schema — `stored_path` column already exists
- Config system — R2 uses env vars only
- Browser extension — no changes to capture payload
- `next.config.mjs` — existing components use `<img>` tags (not Next.js `<Image>`), so `remotePatterns` is not needed for R2 URLs

## Data Flow

```
Capture (browser extension)
  → POST /api/ingest { media_urls: ["https://pbs.twimg.com/..."] }
  → ingestItem()
    → Create Media records individually (get IDs back)
    → Return response immediately
    → Background (fire-and-forget):
      → isR2Configured()?
        → YES: fetch CDN URL → upload to R2 → update stored_path
        → NO:  skip (stored_path stays NULL)
  → Frontend renders: stored_path || original_url
```

```
Backfill (settings page)
  → GET /api/media/backfill (SSE)
  → For each Media where stored_path IS NULL:
    → fetch original_url → upload to R2 → update stored_path
    → Stream progress: { progress, processed, total, current, done }
  → Frontend: ProgressBar shows completion
```
