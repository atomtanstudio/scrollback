# Cloudflare R2 Media Storage Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Download and store captured media in Cloudflare R2 during ingest, with a backfill endpoint for existing items.

**Architecture:** Thin R2 client (`@aws-sdk/client-s3`) wraps upload/delete. During ingest, media is downloaded and uploaded to R2 in the background (fire-and-forget, same pattern as embedding generation). A backfill SSE endpoint handles existing items. R2 is optional — if not configured, the app works exactly as before.

**Tech Stack:** `@aws-sdk/client-s3`, Next.js API routes (SSE), Prisma

**Spec:** `docs/superpowers/specs/2026-03-12-r2-media-storage-design.md`

---

## File Map

### Create
| File | Responsibility |
|------|----------------|
| `lib/storage/r2.ts` | R2 client: `isR2Configured()`, `uploadMedia()`, `deleteMedia()` |
| `lib/storage/download.ts` | Fetch URL → upload to R2 → return public URL |
| `app/api/media/backfill/route.ts` | SSE endpoint: backfill all media without `stored_path` |

### Modify
| File | Change |
|------|--------|
| `lib/ingest/index.ts` | Switch `createMany` → individual `create`, add background R2 download |
| `app/api/items/route.ts:61-67` | Fix `media_preview.url` to use `stored_path \|\| original_url` |
| `app/api/settings/route.ts:20-44` | Add `r2` field to GET response |
| `components/settings/settings-page.tsx:11-17,65` | Add `r2` to `SettingsData`, pass to `DataSection` |
| `components/settings/sections/data-section.tsx` | Add R2 backfill UI with `ProgressBar` |
| `.env.example` | Add R2 env vars |
| `README.md` | Add R2 setup instructions |
| `package.json` | Add `@aws-sdk/client-s3` |

---

## Chunk 1: R2 Client + Download Helper

### Task 1: Install `@aws-sdk/client-s3`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

```bash
npm install @aws-sdk/client-s3
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('@aws-sdk/client-s3'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @aws-sdk/client-s3 for R2 storage"
```

---

### Task 2: Create R2 client wrapper

**Files:**
- Create: `lib/storage/r2.ts`
- Create: `__tests__/lib/storage/r2.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/lib/storage/r2.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("R2 client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isR2Configured", () => {
    it("returns false when no env vars are set", async () => {
      delete process.env.R2_ACCOUNT_ID;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
      delete process.env.R2_PUBLIC_URL;

      // Dynamic import to pick up env changes
      const { isR2Configured } = await import("@/lib/storage/r2");
      expect(isR2Configured()).toBe(false);
    });

    it("returns false when only some env vars are set", async () => {
      process.env.R2_ACCOUNT_ID = "test-account";
      process.env.R2_ACCESS_KEY_ID = "test-key";
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET_NAME;
      delete process.env.R2_PUBLIC_URL;

      const { isR2Configured } = await import("@/lib/storage/r2");
      expect(isR2Configured()).toBe(false);
    });

    it("returns true when all env vars are set", async () => {
      process.env.R2_ACCOUNT_ID = "test-account";
      process.env.R2_ACCESS_KEY_ID = "test-key";
      process.env.R2_SECRET_ACCESS_KEY = "test-secret";
      process.env.R2_BUCKET_NAME = "test-bucket";
      process.env.R2_PUBLIC_URL = "https://media.example.com";

      const { isR2Configured } = await import("@/lib/storage/r2");
      expect(isR2Configured()).toBe(true);
    });
  });

  describe("getPublicUrl", () => {
    it("constructs public URL from key", async () => {
      process.env.R2_PUBLIC_URL = "https://media.example.com";
      const { getPublicUrl } = await import("@/lib/storage/r2");
      expect(getPublicUrl("media/abc/def.jpg")).toBe("https://media.example.com/media/abc/def.jpg");
    });

    it("handles trailing slash in R2_PUBLIC_URL", async () => {
      process.env.R2_PUBLIC_URL = "https://media.example.com/";
      const { getPublicUrl } = await import("@/lib/storage/r2");
      expect(getPublicUrl("media/abc/def.jpg")).toBe("https://media.example.com/media/abc/def.jpg");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/storage/r2.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement R2 client**

```typescript
// lib/storage/r2.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const REQUIRED_ENV_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

export function isR2Configured(): boolean {
  return REQUIRED_ENV_VARS.every((key) => !!process.env[key]);
}

export function getPublicUrl(key: string): string {
  const base = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
  return `${base}/${key}`;
}

function getClient(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function uploadMedia(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return getPublicUrl(key);
}

export async function deleteMedia(key: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    })
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run __tests__/lib/storage/r2.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/storage/r2.ts __tests__/lib/storage/r2.test.ts
git commit -m "feat: add R2 client wrapper with isR2Configured and uploadMedia"
```

---

### Task 3: Create media download helper

**Files:**
- Create: `lib/storage/download.ts`
- Create: `__tests__/lib/storage/download.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// __tests__/lib/storage/download.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock r2 module
vi.mock("@/lib/storage/r2", () => ({
  isR2Configured: vi.fn(() => true),
  uploadMedia: vi.fn(async (key: string) => `https://media.example.com/${key}`),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("downloadAndStoreMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("downloads image and uploads to R2, returns public URL", async () => {
    const imageBuffer = Buffer.from("fake-image-data");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg", "content-length": "100" }),
      arrayBuffer: async () => imageBuffer.buffer,
    });

    const { downloadAndStoreMedia } = await import("@/lib/storage/download");
    const result = await downloadAndStoreMedia("media-123", "item-456", "https://pbs.twimg.com/media/photo.jpg");

    expect(result).toBe("https://media.example.com/media/item-456/media-123.jpg");
    expect(mockFetch).toHaveBeenCalledWith("https://pbs.twimg.com/media/photo.jpg", expect.any(Object));
  });

  it("returns null on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const { downloadAndStoreMedia } = await import("@/lib/storage/download");
    const result = await downloadAndStoreMedia("media-123", "item-456", "https://example.com/gone.jpg");

    expect(result).toBeNull();
  });

  it("returns null when file exceeds 50MB", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg", "content-length": String(51 * 1024 * 1024) }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    const { downloadAndStoreMedia } = await import("@/lib/storage/download");
    const result = await downloadAndStoreMedia("media-123", "item-456", "https://example.com/huge.jpg");

    expect(result).toBeNull();
  });

  it("extracts extension from content-type when URL has no extension", async () => {
    const imageBuffer = Buffer.from("fake-image-data");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "image/png", "content-length": "100" }),
      arrayBuffer: async () => imageBuffer.buffer,
    });

    const { uploadMedia } = await import("@/lib/storage/r2");
    const { downloadAndStoreMedia } = await import("@/lib/storage/download");
    await downloadAndStoreMedia("media-123", "item-456", "https://example.com/image");

    expect(uploadMedia).toHaveBeenCalledWith(
      "media/item-456/media-123.png",
      expect.any(Buffer),
      "image/png"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/storage/download.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement download helper**

```typescript
// lib/storage/download.ts
import { uploadMedia } from "./r2";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DOWNLOAD_TIMEOUT = 30_000; // 30 seconds

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

function extractExtension(url: string, contentType: string): string {
  // Try URL first
  const urlPath = url.split("?")[0];
  const urlExt = urlPath.split(".").pop()?.toLowerCase();
  if (urlExt && urlExt.length <= 5 && /^[a-z0-9]+$/.test(urlExt)) {
    return urlExt;
  }

  // Fall back to content-type
  return CONTENT_TYPE_TO_EXT[contentType] || "bin";
}

export async function downloadAndStoreMedia(
  mediaId: string,
  contentItemId: string,
  originalUrl: string
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

    const response = await fetch(originalUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "FeedSilo/1.0" },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`Media download failed (${response.status}): ${originalUrl}`);
      return null;
    }

    // Check file size
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_FILE_SIZE) {
      console.warn(`Media too large (${contentLength} bytes), skipping: ${originalUrl}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const ext = extractExtension(originalUrl, contentType);
    const key = `media/${contentItemId}/${mediaId}.${ext}`;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await uploadMedia(key, buffer, contentType);
  } catch (error) {
    console.warn(`Media download error for ${originalUrl}:`, error instanceof Error ? error.message : error);
    return null;
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run __tests__/lib/storage/download.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/storage/download.ts __tests__/lib/storage/download.test.ts
git commit -m "feat: add media download helper for R2 upload"
```

---

## Chunk 2: Ingest Integration + Bug Fix

### Task 4: Modify ingest to download media to R2

**Files:**
- Modify: `lib/ingest/index.ts`

The current code at line 73 uses `prisma.media.createMany()` which doesn't return IDs. Switch to individual `create` calls and add background R2 download.

- [ ] **Step 1: Refactor media creation from `createMany` to individual `create` calls**

In `lib/ingest/index.ts`, replace lines 69-81:

```typescript
// OLD (lines 71-83):
if (payload.media_urls && payload.media_urls.length > 0) {
  // TODO: SQLite uses prisma.mediaItem — abstract when adding SQLite ingest support
  await prisma.media.createMany({
    data: payload.media_urls.map((url, position) => ({
      id: uuidv4(),
      content_item_id: itemId,
      media_type: detectMediaType(url) as any,
      original_url: url,
      position_in_content: position,
    })),
  });
}
```

```typescript
// NEW:
// TODO: SQLite uses prisma.mediaItem — abstract when adding SQLite ingest support
const mediaRecords: Array<{ id: string; originalUrl: string }> = [];
if (payload.media_urls && payload.media_urls.length > 0) {
  for (let i = 0; i < payload.media_urls.length; i++) {
    const url = payload.media_urls[i];
    const mediaId = uuidv4();
    await prisma.media.create({
      data: {
        id: mediaId,
        content_item_id: itemId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        media_type: detectMediaType(url) as any,
        original_url: url,
        position_in_content: i,
      },
    });
    mediaRecords.push({ id: mediaId, originalUrl: url });
  }
}
```

- [ ] **Step 2: Add background R2 download after the existing `indexItemInBackground` call**

After line 86 (the `indexItemInBackground` call), add:

```typescript
// Fire-and-forget R2 media download
if (mediaRecords.length > 0) {
  downloadMediaInBackground(itemId, mediaRecords).catch((err) =>
    console.error(`Background media download failed for ${itemId}:`, err)
  );
}
```

- [ ] **Step 3: Add the `downloadMediaInBackground` function and import**

Add import at top of file:
```typescript
import { isR2Configured } from "@/lib/storage/r2";
import { downloadAndStoreMedia } from "@/lib/storage/download";
```

Add function at bottom of file:
```typescript
async function downloadMediaInBackground(
  contentItemId: string,
  mediaRecords: Array<{ id: string; originalUrl: string }>
): Promise<void> {
  if (!isR2Configured()) return;

  const prisma = await getClient();
  for (const { id, originalUrl } of mediaRecords) {
    try {
      const storedUrl = await downloadAndStoreMedia(id, contentItemId, originalUrl);
      if (storedUrl) {
        await prisma.media.update({
          where: { id },
          data: { stored_path: storedUrl },
        });
      }
    } catch (error) {
      console.warn(`Failed to download media ${id}:`, error instanceof Error ? error.message : error);
      // Continue with next media item
    }
  }
}
```

- [ ] **Step 4: Run existing tests and build**

```bash
npx vitest run && npx next build
```
Expected: All tests pass, build succeeds

- [ ] **Step 5: Commit**

```bash
git add lib/ingest/index.ts
git commit -m "feat: add background R2 media download during ingest"
```

---

### Task 5: Fix broken `media_preview.url` in items API

**Files:**
- Modify: `app/api/items/route.ts:61-67`

- [ ] **Step 1: Fix the media_preview URL**

In `app/api/items/route.ts`, replace lines 61-67 (the `media_preview` construction in the offset-pagination branch only — the `excludeIds` branch on lines 8-16 is already correct):

```typescript
// OLD (lines 61-67):
media_preview: item.media_items[0]
  ? {
      id: item.media_items[0].id,
      type: item.media_items[0].media_type,
      url: `/api/media/${item.media_items[0].id}`,
    }
  : null,
```

```typescript
// NEW:
media_preview: item.media_items[0]
  ? {
      id: item.media_items[0].id,
      type: item.media_items[0].media_type,
      url: item.media_items[0].stored_path || item.media_items[0].original_url,
    }
  : null,
```

- [ ] **Step 2: Build to verify**

```bash
npx next build
```
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add app/api/items/route.ts
git commit -m "fix: use stored_path || original_url for media_preview instead of broken proxy URL"
```

---

## Chunk 3: Backfill Endpoint + Settings UI

### Task 6: Create backfill SSE endpoint

**Files:**
- Create: `app/api/media/backfill/route.ts`

- [ ] **Step 1: Implement the backfill endpoint**

Follow the exact SSE pattern from `app/api/search/reindex/route.ts`.

```typescript
// app/api/media/backfill/route.ts
import { getClient } from "@/lib/db/client";
import { isR2Configured } from "@/lib/storage/r2";
import { downloadAndStoreMedia } from "@/lib/storage/download";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        if (!isR2Configured()) {
          send({ error: "R2 storage is not configured. Set R2_* environment variables.", done: true });
          controller.close();
          return;
        }

        const prisma = await getClient();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mediaItems = await (prisma as any).media.findMany({
          where: { stored_path: null },
          select: { id: true, content_item_id: true, original_url: true },
        });

        const total = mediaItems.length;
        if (total === 0) {
          send({ progress: 1, processed: 0, total: 0, current: "All media already stored", done: true });
          controller.close();
          return;
        }

        let processed = 0;

        for (const item of mediaItems) {
          try {
            const storedUrl = await downloadAndStoreMedia(
              item.id,
              item.content_item_id,
              item.original_url
            );

            if (storedUrl) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (prisma as any).media.update({
                where: { id: item.id },
                data: { stored_path: storedUrl },
              });
            }
          } catch {
            // Skip failed downloads, continue with next
          }

          processed++;
          send({
            progress: processed / total,
            processed,
            total,
            current: `Downloading media ${processed}/${total}`,
          });
        }

        send({ progress: 1, processed, total, done: true });
      } catch (err) {
        send({
          error: err instanceof Error ? err.message : "Backfill failed",
          done: true,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Build to verify**

```bash
npx next build
```
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add app/api/media/backfill/route.ts
git commit -m "feat: add SSE endpoint for backfilling media to R2"
```

---

### Task 7: Add R2 status to settings API

**Files:**
- Modify: `app/api/settings/route.ts:20-44`

- [ ] **Step 1: Add R2 config status and media counts to GET response**

In `app/api/settings/route.ts`, add imports at top (alongside existing imports):
```typescript
import { getClient } from "@/lib/db/client";
import { isR2Configured } from "@/lib/storage/r2";
```

Note: `getClient` is a static top-level import, consistent with every other route in the codebase. `disconnectClient` is already imported from `@/lib/db/client` — add `getClient` to the same import statement.

In the `GET` function, after `const config = getConfig();` (line 21), add a helper to get media counts. Then add `r2` field to the response object (after the `search` field, before closing brace on line 44):

```typescript
export async function GET() {
  const config = getConfig();
  if (!config) {
    return NextResponse.json({ configured: false });
  }

  // R2 media counts
  let r2 = { configured: false, mediaWithStored: 0, mediaWithoutStored: 0 };
  const r2Configured = isR2Configured();
  if (r2Configured) {
    try {
      const prisma = await getClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [withStored, withoutStored] = await Promise.all([
        (prisma as any).media.count({ where: { stored_path: { not: null } } }),
        (prisma as any).media.count({ where: { stored_path: null } }),
      ]);
      r2 = { configured: true, mediaWithStored: withStored, mediaWithoutStored: withoutStored };
    } catch {
      r2 = { configured: true, mediaWithStored: 0, mediaWithoutStored: 0 };
    }
  }

  return NextResponse.json({
    configured: true,
    database: {
      type: config.database.type,
      url: maskUrl(config.database.url),
    },
    embeddings: {
      provider: config.embeddings?.provider || "gemini",
      apiKey: config.embeddings?.apiKey ? "••••••••" : null,
      hasKey: !!config.embeddings?.apiKey,
    },
    extension: {
      pairingToken: config.extension?.pairingToken || null,
    },
    search: {
      keywordWeight: config.search.keywordWeight,
      semanticWeight: config.search.semanticWeight,
    },
    r2,
  });
}
```

- [ ] **Step 2: Build to verify**

```bash
npx next build
```
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add app/api/settings/route.ts
git commit -m "feat: expose R2 config status and media counts in settings API"
```

---

### Task 8: Add media backfill UI to settings page

**Files:**
- Modify: `components/settings/settings-page.tsx:11-17,65`
- Modify: `components/settings/sections/data-section.tsx`

- [ ] **Step 1: Update `SettingsData` interface in `settings-page.tsx`**

Add `r2` to the `SettingsData` interface (line 17):

```typescript
interface SettingsData {
  configured: boolean;
  database?: { type: string; url: string };
  embeddings?: { provider: string; apiKey: string | null; hasKey: boolean };
  extension?: { pairingToken: string | null };
  search?: { keywordWeight: number; semanticWeight: number };
  r2?: { configured: boolean; mediaWithStored: number; mediaWithoutStored: number };
}
```

Update the `DataSection` usage (line 65) to pass `settings`:

```typescript
// OLD:
<DataSection stats={stats} />

// NEW:
<DataSection stats={stats} settings={settings} />
```

- [ ] **Step 2: Update `DataSection` to accept settings and show R2 backfill**

In `components/settings/sections/data-section.tsx`, update the props interface and add the backfill UI:

```typescript
"use client";

import { useState } from "react";
import { DangerZone } from "@/components/shared/danger-zone";
import { ProgressBar } from "@/components/shared/progress-bar";

interface DataSectionProps {
  stats: { total: number; tweets: number; threads: number; articles: number; art: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings?: any;
}

export function DataSection({ stats, settings }: DataSectionProps) {
  const [deleteResult, setDeleteResult] = useState<string | null>(null);
  const r2 = settings?.r2;

  const handleDelete = async () => {
    const res = await fetch("/api/data", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "DELETE" }),
    });
    const data = await res.json();
    if (data.success) {
      setDeleteResult(`Deleted ${data.deletedCount} items`);
      setTimeout(() => window.location.reload(), 1500);
    } else {
      throw new Error(data.error || "Delete failed");
    }
  };

  const handleExport = (format: "json" | "csv") => {
    window.open(`/api/export?format=${format}`, "_blank");
  };

  return (
    <div className="rounded-[14px] border border-[#ffffff0a] bg-[#111118] p-6">
      <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5] mb-4">Data</h3>

      <div className="flex flex-col gap-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" value={stats.total} color="var(--accent-thread)" />
          <StatCard label="Tweets" value={stats.tweets} color="var(--accent-tweet)" />
          <StatCard label="Threads" value={stats.threads} color="var(--accent-thread)" />
          <StatCard label="Articles" value={stats.articles} color="var(--accent-article)" />
        </div>

        {/* Media Storage (R2) */}
        {r2?.configured && (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-medium text-[#f0f0f5]">Media Storage (R2)</h4>
            {r2.mediaWithoutStored > 0 ? (
              <>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {r2.mediaWithoutStored} of {r2.mediaWithStored + r2.mediaWithoutStored} media items pending download
                </p>
                <ProgressBar
                  endpoint="/api/media/backfill"
                  buttonLabel="Download Media to R2"
                />
              </>
            ) : (
              <p className="text-xs text-emerald-400">
                All {r2.mediaWithStored} media items stored in R2
              </p>
            )}
          </div>
        )}

        {/* Export */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-[#f0f0f5]">Export</h4>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("json")}
              className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[#1a1a24] text-[#f0f0f5] border border-[#ffffff12] hover:border-[#ffffff24] transition-all duration-200 cursor-pointer"
            >
              Export JSON
            </button>
            <button
              onClick={() => handleExport("csv")}
              className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[#1a1a24] text-[#f0f0f5] border border-[#ffffff12] hover:border-[#ffffff24] transition-all duration-200 cursor-pointer"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Delete result */}
        {deleteResult && (
          <p className="text-xs text-emerald-400">{deleteResult}</p>
        )}

        {/* Danger zone */}
        <DangerZone
          title="Delete All Data"
          description="This will permanently delete all captured content, media, and search indices. Categories and tags will be preserved. This action cannot be undone."
          buttonLabel="Delete All Data"
          onConfirm={handleDelete}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-[10px] bg-[#0a0a0f] border border-[#ffffff0a] p-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">{label}</p>
      <p className="text-lg font-heading font-bold" style={{ color }}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Build to verify**

```bash
npx next build
```
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add components/settings/settings-page.tsx components/settings/sections/data-section.tsx
git commit -m "feat: add R2 media backfill UI to settings data section"
```

---

## Chunk 4: Documentation + Verification

### Task 9: Update `.env.example` and `README.md`

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add R2 env vars to `.env.example`**

Append after the `SEARCH_VECTOR_WEIGHT` line:

```
# Media storage (Cloudflare R2, optional)
# R2_ACCOUNT_ID=
# R2_ACCESS_KEY_ID=
# R2_SECRET_ACCESS_KEY=
# R2_BUCKET_NAME=feedsilo-media
# R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

- [ ] **Step 2: Add R2 variables to the README environment variables table**

Add these rows to the table in the "Environment Variables" section:

```markdown
| `R2_ACCOUNT_ID`       | No       | Cloudflare account ID (for media storage) |
| `R2_ACCESS_KEY_ID`    | No       | R2 API token access key                   |
| `R2_SECRET_ACCESS_KEY`| No       | R2 API token secret key                   |
| `R2_BUCKET_NAME`      | No       | R2 bucket name (e.g. `feedsilo-media`)    |
| `R2_PUBLIC_URL`       | No       | R2 public bucket URL or custom domain     |
```

Also add to the Features list:
```markdown
- **Media Storage** — Cloudflare R2 for persistent media storage (optional)
```

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs: add R2 configuration to .env.example and README"
```

---

### Task 10: Full verification

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```
Expected: All tests pass

- [ ] **Step 2: Run build**

```bash
npx next build
```
Expected: Build succeeds with no errors

- [ ] **Step 3: Run lint**

```bash
npx next lint
```
Expected: No errors (warnings OK)

- [ ] **Step 4: Verify no R2 env vars are hardcoded**

```bash
grep -r "R2_ACCOUNT_ID\|R2_ACCESS_KEY_ID\|R2_SECRET_ACCESS_KEY" --include="*.ts" --include="*.tsx" lib/ app/ components/ | grep -v "process.env" | grep -v "test"
```
Expected: No output (no hardcoded values)

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git status
# If changes needed, commit with appropriate message
```
