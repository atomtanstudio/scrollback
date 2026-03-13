# Session 3 Chunk 3: Settings Page + Header — Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a settings page with 5 configuration sections (Database, Extension, Search, Embeddings, Data) and extract the header into a shared component with a settings gear icon.

**Architecture:** Server shell at `app/settings/page.tsx` renders a client `SettingsPage` component. Each section is a collapsible card. API endpoints handle settings CRUD, SSE progress streams for reindex/embeddings, and data export. Header component extracted from home-page and reused across both pages.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, lucide-react icons, SSE (EventSource)

**Spec:** `docs/superpowers/specs/2026-03-12-session3-onboarding-settings-design.md` (Chunk 3 section, lines 241-343)

---

## File Structure

### Files to Create

| File | Responsibility |
|------|---------------|
| `components/header.tsx` | Shared header: logo, capture count, settings gear icon |
| `app/api/settings/route.ts` | GET (read settings masked) / POST (update settings) |
| `app/api/settings/regenerate-token/route.ts` | POST: generate new pairing token |
| `app/api/data/route.ts` | DELETE: delete all content data |
| `app/api/export/route.ts` | GET: stream JSON/CSV export |
| `app/api/search/reindex/route.ts` | GET SSE: rebuild search indices |
| `app/api/embeddings/generate-missing/route.ts` | GET SSE: generate missing embeddings |
| `components/shared/progress-bar.tsx` | Animated progress bar driven by SSE |
| `components/shared/danger-zone.tsx` | Red border section with typed confirmation |
| `app/settings/page.tsx` | Server shell with metadata |
| `components/settings/settings-page.tsx` | Client component: layout with 5 sections |
| `components/settings/sections/database-section.tsx` | DB status, connection test, switch DB |
| `components/settings/sections/extension-section.tsx` | Token display, regenerate |
| `components/settings/sections/search-section.tsx` | Search weights, reindex |
| `components/settings/sections/embeddings-section.tsx` | API key, coverage, generate missing |
| `components/settings/sections/data-section.tsx` | Stats, export, delete all |

### Files to Modify

| File | Change |
|------|--------|
| `components/home-page.tsx` | Replace inline header with `<Header>` component |

---

## Task 1: Header Component Extraction

**Files:**
- Create: `components/header.tsx`
- Modify: `components/home-page.tsx`

- [ ] **Step 1: Create Header component**

Create `components/header.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

interface HeaderProps {
  captureCount?: number;
}

export function Header({ captureCount }: HeaderProps) {
  return (
    <header className="flex items-center justify-between py-6">
      <Link
        href="/"
        className="font-heading font-semibold text-[21px] tracking-tight text-[#f0f0f5] flex items-center hover:opacity-80 transition-opacity"
      >
        feed
        <span className="inline-block w-[5px] h-[5px] rounded-full bg-[var(--accent-thread)] mx-[1px] relative top-[1px]" />
        silo
      </Link>

      <div className="flex items-center gap-4">
        {captureCount !== undefined && (
          <span className="text-[13px] text-[#555566]">
            {captureCount.toLocaleString()} captures
          </span>
        )}
        <Link
          href="/settings"
          className="text-[#555566] hover:text-[#f0f0f5] transition-colors"
          aria-label="Settings"
        >
          <Settings size={18} />
        </Link>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Update home-page.tsx to use Header**

In `components/home-page.tsx`:
- Add import: `import { Header } from "@/components/header";`
- Replace the inline `<header>...</header>` block (lines 22-27) with: `<Header captureCount={stats.total} />`

- [ ] **Step 3: Commit**

```bash
git add components/header.tsx components/home-page.tsx
git commit -m "feat: extract header into shared component with settings gear icon"
```

---

## Task 2: Settings API Endpoints (GET/POST settings, regenerate-token)

**Files:**
- Create: `app/api/settings/route.ts`
- Create: `app/api/settings/regenerate-token/route.ts`

- [ ] **Step 1: Create GET/POST /api/settings**

Create `app/api/settings/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getConfig, writeConfig, readConfig, invalidateConfigCache } from "@/lib/config";
import { disconnectClient } from "@/lib/db/client";
import { invalidateSearchProvider } from "@/lib/db/search-provider";
import type { FeedsiloConfig } from "@/lib/config";

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "••••••••";
    }
    return parsed.toString();
  } catch {
    // SQLite file: URLs
    return url;
  }
}

export async function GET() {
  const config = getConfig();
  if (!config) {
    return NextResponse.json({ configured: false });
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
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const current = readConfig() || getConfig();
    if (!current) {
      return NextResponse.json({ error: "Not configured" }, { status: 400 });
    }

    const updated: FeedsiloConfig = { ...current };

    if (body.database) {
      updated.database = { ...current.database, ...body.database };
    }
    if (body.embeddings) {
      updated.embeddings = { ...current.embeddings, ...body.embeddings };
    }
    if (body.extension) {
      updated.extension = { ...current.extension, ...body.extension };
    }
    if (body.search) {
      updated.search = { ...current.search, ...body.search };
    }

    writeConfig(updated);
    invalidateConfigCache();

    // If database changed, disconnect old client
    if (body.database) {
      await disconnectClient();
      invalidateSearchProvider();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create POST /api/settings/regenerate-token**

Create `app/api/settings/regenerate-token/route.ts`:

```ts
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readConfig, getConfig, writeConfig, invalidateConfigCache } from "@/lib/config";

export async function POST() {
  try {
    const current = readConfig() || getConfig();
    if (!current) {
      return NextResponse.json({ error: "Not configured" }, { status: 400 });
    }

    const newToken = uuidv4();
    const updated = {
      ...current,
      extension: { ...current.extension, pairingToken: newToken },
    };

    writeConfig(updated);
    invalidateConfigCache();

    return NextResponse.json({ token: newToken });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to regenerate token" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/settings/route.ts app/api/settings/regenerate-token/route.ts
git commit -m "feat: add settings API endpoints (GET/POST settings, regenerate-token)"
```

---

## Task 3: Data Deletion + Export API Endpoints

**Files:**
- Create: `app/api/data/route.ts`
- Create: `app/api/export/route.ts`

- [ ] **Step 1: Create DELETE /api/data**

Create `app/api/data/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getClient, getDatabaseType } from "@/lib/db/client";

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    if (body.confirmation !== "DELETE") {
      return NextResponse.json(
        { error: "Type DELETE to confirm" },
        { status: 400 }
      );
    }

    const prisma = await getClient();
    const dbType = getDatabaseType();

    // Delete all content items (cascades to media, categories, tags relations)
    const result = await prisma.contentItem.deleteMany({});

    // Clear FTS5 table for SQLite
    if (dbType === "sqlite") {
      try {
        await prisma.$executeRawUnsafe(
          `DELETE FROM content_items_fts`
        );
      } catch {
        // FTS table might not exist yet
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create GET /api/export**

Create `app/api/export/route.ts`:

```ts
import { getClient } from "@/lib/db/client";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") || "json";
  const prisma = await getClient();

  const items = await prisma.contentItem.findMany({
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      source_type: true,
      title: true,
      body_text: true,
      author_handle: true,
      author_display_name: true,
      original_url: true,
      posted_at: true,
      created_at: true,
      likes: true,
      retweets: true,
      replies: true,
      views: true,
    },
  });

  if (format === "csv") {
    const headers = [
      "id", "source_type", "title", "body_text", "author_handle",
      "author_display_name", "original_url", "posted_at", "created_at",
      "likes", "retweets", "replies", "views",
    ];

    const escapeCsv = (val: unknown) => {
      const s = String(val ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [headers.join(",")];
    for (const item of items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = headers.map((h) => escapeCsv((item as any)[h]));
      lines.push(row.join(","));
    }

    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="feedsilo-export.csv"',
      },
    });
  }

  // JSON (NDJSON)
  const ndjson = items.map((item) => JSON.stringify(item)).join("\n");

  return new Response(ndjson, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": 'attachment; filename="feedsilo-export.json"',
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/data/route.ts app/api/export/route.ts
git commit -m "feat: add data deletion and export API endpoints"
```

---

## Task 4: SSE Endpoints (Reindex + Generate Missing Embeddings)

**Files:**
- Create: `app/api/search/reindex/route.ts`
- Create: `app/api/embeddings/generate-missing/route.ts`

- [ ] **Step 1: Create GET /api/search/reindex (SSE)**

Create `app/api/search/reindex/route.ts`:

```ts
import { getClient } from "@/lib/db/client";
import { getSearchProvider } from "@/lib/db/search-provider";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const prisma = await getClient();
        const provider = await getSearchProvider();

        const items = await prisma.contentItem.findMany({
          select: {
            id: true,
            title: true,
            body_text: true,
            ai_summary: true,
            author_handle: true,
            author_display_name: true,
          },
        });

        const total = items.length;
        if (total === 0) {
          send({ progress: 1, processed: 0, total: 0, done: true });
          controller.close();
          return;
        }

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const authorParts = [item.author_handle, item.author_display_name]
            .filter(Boolean)
            .join(" ");

          await provider.updateSearchVector(item.id, {
            title: item.title || "",
            body: item.body_text || "",
            summary: item.ai_summary || undefined,
            author: authorParts || undefined,
          });

          send({
            progress: (i + 1) / total,
            processed: i + 1,
            total,
            current: `Indexing "${(item.title || "").slice(0, 40)}..."`,
          });
        }

        send({ progress: 1, processed: total, total, done: true });
      } catch (err) {
        send({
          error: err instanceof Error ? err.message : "Reindex failed",
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

- [ ] **Step 2: Create GET /api/embeddings/generate-missing (SSE)**

Create `app/api/embeddings/generate-missing/route.ts`:

```ts
import { getClient } from "@/lib/db/client";
import { getSearchProvider } from "@/lib/db/search-provider";
import { generateEmbedding } from "@/lib/embeddings/gemini";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        if (!process.env.GEMINI_API_KEY) {
          send({ error: "GEMINI_API_KEY not configured", done: true });
          controller.close();
          return;
        }

        const prisma = await getClient();
        const provider = await getSearchProvider();

        const items = await prisma.contentItem.findMany({
          where: {
            processing_status: { not: "indexed" },
          },
          select: {
            id: true,
            title: true,
            body_text: true,
            author_handle: true,
            author_display_name: true,
          },
        });

        const total = items.length;
        if (total === 0) {
          send({ progress: 1, processed: 0, total: 0, done: true });
          controller.close();
          return;
        }

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          try {
            const embeddingText = [
              item.title,
              item.body_text,
              item.author_handle,
              item.author_display_name,
            ]
              .filter(Boolean)
              .join(" ");

            const embedding = await generateEmbedding(embeddingText);
            await provider.writeEmbedding(item.id, embedding);

            await prisma.contentItem.update({
              where: { id: item.id },
              data: { processing_status: "indexed" },
            });

            send({
              progress: (i + 1) / total,
              processed: i + 1,
              total,
              current: `Processing "${(item.title || "").slice(0, 40)}..."`,
            });
          } catch (err) {
            send({
              progress: (i + 1) / total,
              processed: i + 1,
              total,
              current: `Failed: ${err instanceof Error ? err.message : "unknown error"}`,
            });
          }
        }

        send({ progress: 1, processed: total, total, done: true });
      } catch (err) {
        send({
          error: err instanceof Error ? err.message : "Generation failed",
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

- [ ] **Step 3: Commit**

```bash
git add app/api/search/reindex/route.ts app/api/embeddings/generate-missing/route.ts
git commit -m "feat: add SSE endpoints for search reindex and embedding generation"
```

---

## Task 5: Shared Components (ProgressBar + DangerZone)

**Files:**
- Create: `components/shared/progress-bar.tsx`
- Create: `components/shared/danger-zone.tsx`

- [ ] **Step 1: Create ProgressBar**

Create `components/shared/progress-bar.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  endpoint: string;
  buttonLabel: string;
  className?: string;
}

type ProgressState = "idle" | "running" | "done" | "error";

interface ProgressData {
  progress: number;
  processed: number;
  total: number;
  current?: string;
  done?: boolean;
  error?: string;
}

export function ProgressBar({ endpoint, buttonLabel, className }: ProgressBarProps) {
  const [state, setState] = useState<ProgressState>("idle");
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(() => {
    setState("running");
    setError(null);
    setData({ progress: 0, processed: 0, total: 0 });

    const es = new EventSource(endpoint);

    es.onmessage = (event) => {
      try {
        const parsed: ProgressData = JSON.parse(event.data);
        setData(parsed);

        if (parsed.error) {
          setState("error");
          setError(parsed.error);
          es.close();
          return;
        }

        if (parsed.done) {
          setState("done");
          es.close();
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setState("error");
      setError("Connection lost");
      es.close();
    };
  }, [endpoint]);

  const percent = data ? Math.round(data.progress * 100) : 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {state === "idle" && (
        <button
          onClick={handleStart}
          className="h-10 px-5 rounded-[10px] text-sm font-medium bg-[#1a1a24] text-[#f0f0f5] border border-[#ffffff12] hover:border-[#ffffff24] transition-all duration-200 cursor-pointer self-start"
        >
          {buttonLabel}
        </button>
      )}

      {(state === "running" || state === "done") && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
            <span>{data?.current || "Starting..."}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 bg-[#1a1a24] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                state === "done" ? "bg-emerald-500" : "bg-[var(--accent-thread)]"
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          {state === "done" && (
            <p className="text-xs text-emerald-400">
              Done — {data?.processed} items processed
            </p>
          )}
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
          <button
            onClick={handleStart}
            className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[#1a1a24] text-[#f0f0f5] border border-[#ffffff12] hover:border-[#ffffff24] transition-all duration-200 cursor-pointer self-start"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create DangerZone**

Create `components/shared/danger-zone.tsx`:

```tsx
"use client";

import { useState } from "react";

interface DangerZoneProps {
  title: string;
  description: string;
  buttonLabel: string;
  onConfirm: () => Promise<void>;
}

export function DangerZone({ title, description, buttonLabel, onConfirm }: DangerZoneProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (typed !== "DELETE") return;
    setLoading(true);
    try {
      await onConfirm();
      setShowConfirm(false);
      setTyped("");
    } catch {
      // Error handling done by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-red-500/30 rounded-[14px] p-5">
      <h4 className="text-sm font-semibold text-red-400 mb-1">{title}</h4>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">{description}</p>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="h-9 px-4 rounded-[10px] text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all duration-200 cursor-pointer"
        >
          {buttonLabel}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-red-400">
            Type <strong>DELETE</strong> to confirm
          </p>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            className="h-10 px-4 rounded-[10px] bg-[#0a0a0f] border border-red-500/30 text-[#f0f0f5] text-sm font-mono placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-red-500/60 transition-colors w-full"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={typed !== "DELETE" || loading}
              className="h-9 px-4 rounded-[10px] text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading ? "Deleting..." : "Confirm Delete"}
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                setTyped("");
              }}
              className="h-9 px-4 rounded-[10px] text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[#f0f0f5] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/shared/progress-bar.tsx components/shared/danger-zone.tsx
git commit -m "feat: add shared ProgressBar and DangerZone components"
```

---

## Task 6: Settings Page Shell + Database & Extension Sections

**Files:**
- Create: `app/settings/page.tsx`
- Create: `components/settings/settings-page.tsx`
- Create: `components/settings/sections/database-section.tsx`
- Create: `components/settings/sections/extension-section.tsx`

- [ ] **Step 1: Create settings page shell**

Create `app/settings/page.tsx`:

```tsx
import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/settings-page";
import { fetchStats } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Settings — FeedSilo",
  description: "Configure your FeedSilo instance",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  let stats = { total: 0, tweets: 0, threads: 0, articles: 0, art: 0 };
  try {
    stats = await fetchStats();
  } catch {
    // Config may not be set up yet
  }

  return <SettingsPage stats={stats} />;
}
```

- [ ] **Step 2: Create SettingsPage client component**

Create `components/settings/settings-page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { DatabaseSection } from "./sections/database-section";
import { ExtensionSection } from "./sections/extension-section";
import { SearchSection } from "./sections/search-section";
import { EmbeddingsSection } from "./sections/embeddings-section";
import { DataSection } from "./sections/data-section";

interface SettingsData {
  configured: boolean;
  database?: { type: string; url: string };
  embeddings?: { provider: string; apiKey: string | null; hasKey: boolean };
  extension?: { pairingToken: string | null };
  search?: { keywordWeight: number; semanticWeight: number };
}

interface SettingsPageProps {
  stats: { total: number; tweets: number; threads: number; articles: number; art: number };
}

export function SettingsPage({ stats }: SettingsPageProps) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <div className="relative z-10 max-w-[960px] mx-auto px-6">
      <Header captureCount={stats.total} />

      <div className="py-8">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-[#f0f0f5] mb-2">
          Settings
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] text-sm mb-8">
          Configure your FeedSilo instance
        </p>

        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded-[14px] bg-[#1a1a24] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <DatabaseSection settings={settings} onRefresh={fetchSettings} />
            <ExtensionSection settings={settings} onRefresh={fetchSettings} />
            <SearchSection settings={settings} onRefresh={fetchSettings} />
            <EmbeddingsSection settings={settings} onRefresh={fetchSettings} />
            <DataSection stats={stats} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create DatabaseSection**

Create `components/settings/sections/database-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ConnectionTester } from "@/components/shared/connection-tester";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DatabaseSectionProps { settings: any; onRefresh: () => void }

export function DatabaseSection({ settings, onRefresh }: DatabaseSectionProps) {
  const [showUrl, setShowUrl] = useState(false);
  const db = settings?.database;

  const handleTest = async () => {
    const res = await fetch("/api/setup/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: db?.type, url: db?.url }),
    });
    return res.json();
  };

  return (
    <div className="rounded-[14px] border border-[#ffffff0a] bg-[#111118] p-6">
      <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5] mb-4">Database</h3>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm text-[#f0f0f5] capitalize">{db?.type || "Not configured"}</span>
        </div>

        {db?.url && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">Connection</label>
              <button
                onClick={() => setShowUrl(!showUrl)}
                className="text-xs text-[var(--accent-tweet)] hover:underline cursor-pointer"
              >
                {showUrl ? "Hide" : "Show"}
              </button>
            </div>
            <code className="text-xs font-mono text-[hsl(var(--muted-foreground))] bg-[#0a0a0f] rounded-lg px-3 py-2 break-all">
              {showUrl ? db.url : "••••••••••••"}
            </code>
          </div>
        )}

        <ConnectionTester onTest={handleTest} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create ExtensionSection**

Create `components/settings/sections/extension-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import { TokenDisplay } from "@/components/shared/token-display";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ExtensionSectionProps { settings: any; onRefresh: () => void }

export function ExtensionSection({ settings, onRefresh }: ExtensionSectionProps) {
  const [regenerating, setRegenerating] = useState(false);
  const token = settings?.extension?.pairingToken;

  const handleRegenerate = async () => {
    if (!confirm("Any connected browser extension will need to be re-paired with the new token. Continue?")) {
      return;
    }
    setRegenerating(true);
    try {
      await fetch("/api/settings/regenerate-token", { method: "POST" });
      onRefresh();
    } catch {
      // Silently fail
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="rounded-[14px] border border-[#ffffff0a] bg-[#111118] p-6">
      <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5] mb-4">
        Browser Extension
      </h3>

      <div className="flex flex-col gap-4">
        {token ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">Pairing token</label>
              <TokenDisplay token={token} />
            </div>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[#1a1a24] text-[#f0f0f5] border border-[#ffffff12] hover:border-[#ffffff24] transition-all duration-200 cursor-pointer self-start disabled:opacity-50"
            >
              {regenerating ? "Regenerating..." : "Regenerate Token"}
            </button>
          </>
        ) : (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No pairing token configured. Set one in the onboarding flow or generate one below.
          </p>
        )}

        {!token && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[var(--accent-thread)] text-[#0a0a0f] font-heading hover:brightness-110 transition-all duration-200 cursor-pointer self-start disabled:opacity-50"
          >
            {regenerating ? "Generating..." : "Generate Token"}
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/settings/page.tsx components/settings/settings-page.tsx components/settings/sections/database-section.tsx components/settings/sections/extension-section.tsx
git commit -m "feat: add settings page with database and extension sections"
```

---

## Task 7: Search & Embeddings Settings Sections

**Files:**
- Create: `components/settings/sections/search-section.tsx`
- Create: `components/settings/sections/embeddings-section.tsx`

- [ ] **Step 1: Create SearchSection**

Create `components/settings/sections/search-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ProgressBar } from "@/components/shared/progress-bar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SearchSectionProps { settings: any; onRefresh: () => void }

export function SearchSection({ settings, onRefresh }: SearchSectionProps) {
  const [keywordWeight, setKeywordWeight] = useState(
    Math.round((settings?.search?.keywordWeight ?? 0.4) * 100)
  );
  const [semanticWeight, setSemanticWeight] = useState(
    Math.round((settings?.search?.semanticWeight ?? 0.6) * 100)
  );
  const [saving, setSaving] = useState(false);

  const isSqlite = settings?.database?.type === "sqlite";

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search: {
            keywordWeight: keywordWeight / 100,
            semanticWeight: semanticWeight / 100,
          },
        }),
      });
      onRefresh();
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[14px] border border-[#ffffff0a] bg-[#111118] p-6">
      <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5] mb-4">Search</h3>

      <div className="flex flex-col gap-5">
        {isSqlite && (
          <div className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Semantic search is not available with SQLite. Only keyword search (FTS5) is used.
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">Keyword weight</label>
              <span className="text-xs text-[#f0f0f5] font-mono">{keywordWeight}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={keywordWeight}
              onChange={(e) => setKeywordWeight(Number(e.target.value))}
              className="w-full accent-[var(--accent-tweet)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">Semantic weight</label>
              <span className="text-xs text-[#f0f0f5] font-mono">{semanticWeight}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={semanticWeight}
              onChange={(e) => setSemanticWeight(Number(e.target.value))}
              className="w-full accent-[var(--accent-thread)]"
              disabled={isSqlite}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[var(--accent-thread)] text-[#0a0a0f] font-heading hover:brightness-110 transition-all duration-200 cursor-pointer self-start disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Weights"}
          </button>
        </div>

        <div className="border-t border-[#ffffff0a] pt-4">
          <h4 className="text-sm font-medium text-[#f0f0f5] mb-3">Rebuild Search Index</h4>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
            Re-index all content items. Use this after importing data or if search results seem stale.
          </p>
          <ProgressBar endpoint="/api/search/reindex" buttonLabel="Rebuild Index" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create EmbeddingsSection**

Create `components/settings/sections/embeddings-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ProgressBar } from "@/components/shared/progress-bar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface EmbeddingsSectionProps { settings: any; onRefresh: () => void }

export function EmbeddingsSection({ settings, onRefresh }: EmbeddingsSectionProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasKey = settings?.embeddings?.hasKey;

  const handleSave = async () => {
    if (!apiKey) return;
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeddings: { apiKey } }),
      });
      setApiKey("");
      onRefresh();
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[14px] border border-[#ffffff0a] bg-[#111118] p-6">
      <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5] mb-4">Embeddings</h3>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[hsl(var(--muted-foreground))]">Gemini API Key</label>
            {hasKey && (
              <span className="text-xs text-emerald-400">configured</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? "••••••••" : "Enter your Gemini API key"}
              className="flex-1 h-10 px-4 rounded-[10px] bg-[#0a0a0f] border border-[#ffffff12] text-[#f0f0f5] text-sm placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-[#ffffff30] transition-colors"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="h-10 px-3 rounded-[10px] text-xs text-[hsl(var(--muted-foreground))] border border-[#ffffff12] hover:border-[#ffffff24] transition-colors cursor-pointer"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {apiKey && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[var(--accent-thread)] text-[#0a0a0f] font-heading hover:brightness-110 transition-all duration-200 cursor-pointer self-start disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save API Key"}
          </button>
        )}

        <div className="text-xs text-[hsl(var(--muted-foreground))]">
          <span>Model: </span>
          <code className="text-[var(--accent-tweet)]">gemini-embedding-001</code>
        </div>

        <div className="border-t border-[#ffffff0a] pt-4">
          <h4 className="text-sm font-medium text-[#f0f0f5] mb-3">Generate Missing Embeddings</h4>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
            Generate vector embeddings for items that don&apos;t have them yet. Requires a Gemini API key.
          </p>
          <ProgressBar
            endpoint="/api/embeddings/generate-missing"
            buttonLabel="Generate Embeddings"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/settings/sections/search-section.tsx components/settings/sections/embeddings-section.tsx
git commit -m "feat: add search and embeddings settings sections with SSE progress"
```

---

## Task 8: Data Settings Section

**Files:**
- Create: `components/settings/sections/data-section.tsx`

- [ ] **Step 1: Create DataSection**

Create `components/settings/sections/data-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import { DangerZone } from "@/components/shared/danger-zone";

interface DataSectionProps {
  stats: { total: number; tweets: number; threads: number; articles: number; art: number };
}

export function DataSection({ stats }: DataSectionProps) {
  const [deleteResult, setDeleteResult] = useState<string | null>(null);

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

- [ ] **Step 2: Commit**

```bash
git add components/settings/sections/data-section.tsx
git commit -m "feat: add data settings section with export and delete functionality"
```

---

## Task 9: Verification

- [ ] **Step 1: Run build**

Run: `npm run build`
Expected: Compiled successfully with `/settings` and all new API routes listed

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 3: Fix any issues**

If build fails, fix ESLint/type errors and commit fixes.

```bash
git add -A
git commit -m "fix: address build issues from settings page implementation"
```
