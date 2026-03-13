# Session 2: Frontend UI Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the FeedSilo frontend — a dark-themed masonry feed with 4 card types (Tweet, Thread, Article, Art), infinite scroll with excludeIds pagination, hybrid search, and a single-item detail page.

**Architecture:** Next.js 14 App Router with server components for initial data fetching and client components for interactivity. Masonry layout ported from `~/Documents/vibecoding/promptsilo/components/masonry-feed.tsx` using absolute positioning with manual column height calculation. API routes use Prisma with `id: { notIn: excludeIds }` for duplicate-free infinite scroll.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS 3, Framer Motion, react-intersection-observer, Prisma (PostgreSQL + pgvector), Plus Jakarta Sans + DM Sans fonts, Vitest

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `app/globals.css` | Update with dark theme variables, gradient utilities, Plus Jakarta Sans |
| `app/layout.tsx` | Update with font imports and dark body class |
| `app/page.tsx` | Server component: fetch initial 50 items + stats, render HomePage |
| `app/item/[id]/page.tsx` | Update: full single-item detail view |
| `app/api/items/route.ts` | Update: add excludeIds support + type filtering |
| `app/api/stats/route.ts` | Create: dashboard counts by source_type |
| `components/home-page.tsx` | Client wrapper: search, filters, stat pills, masonry feed |
| `components/masonry-feed.tsx` | Masonry layout engine + infinite scroll (ported from promptsilo) |
| `components/cards/tweet-card.tsx` | Tweet card with gradient background |
| `components/cards/thread-card.tsx` | Thread card with stacked effect |
| `components/cards/article-card.tsx` | Article card with thumbnail |
| `components/cards/art-card.tsx` | Art card with tool badge + prompt |
| `components/cards/card-wrapper.tsx` | Shared gradient border wrapper |
| `components/cards/content-card.tsx` | Router: picks correct card type by source_type |
| `components/card-skeleton.tsx` | Loading skeleton for masonry grid |
| `components/search-bar.tsx` | Gradient-bordered search input |
| `components/stat-pills.tsx` | Dashboard stat counts |
| `components/filter-pills.tsx` | Content type filter buttons |
| `lib/db/queries.ts` | Create: shared query functions (fetchItems, fetchStats) |

### Existing Files Modified
| File | Change |
|------|--------|
| `app/globals.css` | Replace theme with dark palette + card gradient utilities |
| `app/layout.tsx` | Add Plus Jakarta Sans font, dark body styling |
| `app/page.tsx` | Replace placeholder with server data fetch + HomePage |
| `app/item/[id]/page.tsx` | Build full detail view |
| `app/api/items/route.ts` | Add excludeIds param, type filtering |

---

## Chunk 1: Foundation — Theme, Fonts, Layout

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install react-intersection-observer**

```bash
npm install react-intersection-observer
```

- [ ] **Step 2: Install @fontsource/plus-jakarta-sans (optional — can use Google Fonts CDN instead)**

```bash
npm install @fontsource-variable/plus-jakarta-sans
```

- [ ] **Step 3: Verify framer-motion is already installed**

```bash
npm ls framer-motion
```

Expected: `framer-motion@12.36.0` already in dependencies.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-intersection-observer and Plus Jakarta Sans font"
```

---

### Task 2: Update global theme CSS

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace globals.css with dark theme**

Replace the entire contents of `app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 240 20% 4%;       /* #0a0a0f */
    --surface: 240 18% 8%;          /* #111118 */
    --surface-elevated: 240 15% 12%; /* #1a1a24 */
    --foreground: 240 10% 95%;      /* #f0f0f5 */
    --muted: 240 10% 35%;           /* #555566 */
    --muted-foreground: 240 12% 60%; /* #8888aa */
    --border: 0 0% 100% / 0.07;
    --border-hover: 0 0% 100% / 0.14;
    --card: 240 18% 8%;
    --card-foreground: 240 10% 95%;
    --primary: 186 78% 53%;         /* #22d3ee cyan */
    --primary-foreground: 240 20% 4%;
    --accent-tweet: #22d3ee;
    --accent-thread: #a78bfa;
    --accent-article: #fb923c;
    --accent-art: #ec4899;
    --radius: 0.75rem;
  }
}

@layer base {
  body {
    @apply bg-[#0a0a0f] text-[#f0f0f5] antialiased;
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  }
}

/* Card gradient backgrounds — shared template */
/* Each card type overrides colors via CSS custom properties on the wrapper */

.card-gradient-tweet {
  background:
    linear-gradient(to top, #0e1018 0%, #0e101880 18%, transparent 40%),
    radial-gradient(ellipse at 0% 0%, #0e1018 0%, transparent 50%),
    radial-gradient(ellipse at 100% 100%, #0e1018 0%, transparent 8%),
    radial-gradient(circle at 97% 3%, #c47a30 0%, #8a5030 3%, transparent 14%),
    radial-gradient(ellipse at 78% 15%, #5a2870 0%, #3a1858 15%, transparent 45%),
    radial-gradient(ellipse at 50% 40%, #1e3068 0%, transparent 55%),
    radial-gradient(ellipse at 40% 60%, #184058 0%, transparent 55%),
    #0e1018;
}

.card-gradient-thread {
  background:
    linear-gradient(to top, #0e1018 0%, #0e101880 18%, transparent 40%),
    radial-gradient(ellipse at 0% 0%, #0e1018 0%, transparent 50%),
    radial-gradient(ellipse at 100% 100%, #0e1018 0%, transparent 8%),
    radial-gradient(circle at 97% 3%, #a04858 0%, #7a3858 3%, transparent 14%),
    radial-gradient(ellipse at 78% 15%, #5a2878 0%, #3a1860 15%, transparent 45%),
    radial-gradient(ellipse at 50% 40%, #1e2870 0%, transparent 55%),
    radial-gradient(ellipse at 40% 60%, #184a60 0%, transparent 55%),
    #0e1018;
}

.card-gradient-article {
  background:
    linear-gradient(to top, #0e1018 0%, #0e101880 18%, transparent 40%),
    radial-gradient(ellipse at 0% 0%, #0e1018 0%, transparent 50%),
    radial-gradient(ellipse at 100% 100%, #0e1018 0%, transparent 8%),
    radial-gradient(circle at 97% 3%, #c48a30 0%, #8a7028 3%, transparent 14%),
    radial-gradient(ellipse at 78% 15%, #3a5a40 0%, #2a4a38 15%, transparent 45%),
    radial-gradient(ellipse at 50% 40%, #1e3060 0%, transparent 55%),
    radial-gradient(ellipse at 40% 60%, #1a2a58 0%, transparent 55%),
    #0e1018;
}

.card-gradient-art {
  background:
    linear-gradient(to top, #0e1018 0%, #0e101880 18%, transparent 40%),
    radial-gradient(ellipse at 0% 0%, #0e1018 0%, transparent 50%),
    radial-gradient(ellipse at 100% 100%, #0e1018 0%, transparent 8%),
    radial-gradient(circle at 97% 3%, #ec4899 0%, #c0387a 3%, transparent 14%),
    radial-gradient(ellipse at 78% 15%, #7a1858 0%, #5a1048 15%, transparent 45%),
    radial-gradient(ellipse at 50% 40%, #2a1860 0%, transparent 55%),
    radial-gradient(ellipse at 40% 60%, #1a2858 0%, transparent 55%),
    #0e1018;
}

/* Border gradient wrappers */
.border-gradient-tweet {
  background: linear-gradient(135deg, #22d3ee50 0%, #22d3ee20 30%, #22d3ee10 50%, #22d3ee20 70%, #22d3ee40 100%);
}
.border-gradient-thread {
  background: linear-gradient(135deg, #a78bfa50 0%, #a78bfa20 30%, #a78bfa10 50%, #a78bfa20 70%, #a78bfa40 100%);
}
.border-gradient-article {
  background: linear-gradient(135deg, #fb923c50 0%, #fb923c20 30%, #fb923c10 50%, #fb923c20 70%, #fb923c40 100%);
}
.border-gradient-art {
  background: linear-gradient(135deg, #ec489950 0%, #ec489920 30%, #ec489910 50%, #ec489920 70%, #ec489940 100%);
}

/* Search bar gradient */
.search-border-gradient {
  background: linear-gradient(135deg, var(--accent-tweet), var(--accent-thread), var(--accent-art), var(--accent-article));
}

/* Background glow effects */
.bg-glow::before {
  content: '';
  position: fixed;
  top: 20%;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
  height: 800px;
  background: radial-gradient(circle, rgba(124, 58, 237, 0.07) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}
.bg-glow::after {
  content: '';
  position: fixed;
  top: 30%;
  left: 60%;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(8, 145, 178, 0.06) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}
```

- [ ] **Step 2: Verify the app still builds**

```bash
npm run build
```

Expected: Build succeeds. Pages may look different (dark background now).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: update theme to dark palette with card gradient utilities"
```

---

### Task 3: Update root layout with fonts

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Read current layout.tsx**

Check the current contents to understand what metadata and structure exists.

- [ ] **Step 2: Update layout.tsx with Plus Jakarta Sans + DM Sans**

```tsx
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FeedSilo",
  description: "Your digital knowledge, searchable.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${plusJakarta.variable} ${dmSans.variable} font-sans bg-glow`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Update tailwind.config.ts to use font variables**

Add to the `extend` section of `tailwind.config.ts`:

```ts
fontFamily: {
  sans: ['var(--font-body)', '-apple-system', 'sans-serif'],
  heading: ['var(--font-heading)', 'var(--font-body)', 'sans-serif'],
},
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx tailwind.config.ts
git commit -m "feat: add Plus Jakarta Sans and DM Sans fonts with CSS variables"
```

---

## Chunk 2: Card Components

### Task 4: Create shared card wrapper

**Files:**
- Create: `components/cards/card-wrapper.tsx`

- [ ] **Step 1: Create the card wrapper component**

This provides the 1px gradient border via the outer wrapper technique.

```tsx
"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type CardType = "tweet" | "thread" | "article" | "art";

const borderGradients: Record<CardType, string> = {
  tweet: "border-gradient-tweet",
  thread: "border-gradient-thread",
  article: "border-gradient-article",
  art: "border-gradient-art",
};

const cardGradients: Record<CardType, string> = {
  tweet: "card-gradient-tweet",
  thread: "card-gradient-thread",
  article: "card-gradient-article",
  art: "card-gradient-art",
};

interface CardWrapperProps {
  type: CardType;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function CardWrapper({ type, children, className, noPadding }: CardWrapperProps) {
  return (
    <div
      className={cn(
        "rounded-[14px] p-px transition-transform duration-200 ease-out cursor-pointer hover:-translate-y-0.5 relative",
        borderGradients[type],
        type === "thread" && "mb-2",
        className
      )}
    >
      {/* Thread stacked card effect */}
      {type === "thread" && (
        <>
          <div className="absolute -bottom-[5px] left-[6px] right-[6px] h-[5px] rounded-b-[14px] bg-gradient-to-r from-[#a78bfa30] via-[#a78bfa10] to-[#a78bfa30]" />
          <div className="absolute -bottom-[10px] left-[14px] right-[14px] h-[5px] rounded-b-[14px] bg-gradient-to-r from-[#a78bfa18] via-[#a78bfa06] to-[#a78bfa18]" />
        </>
      )}
      <div
        className={cn(
          "rounded-[13px] relative h-full",
          cardGradients[type],
          !noPadding && "p-5"
        )}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cards/card-wrapper.tsx
git commit -m "feat: create CardWrapper with gradient borders and card backgrounds"
```

---

### Task 5: Create tweet card

**Files:**
- Create: `components/cards/tweet-card.tsx`

- [ ] **Step 1: Create the tweet card component**

```tsx
"use client";

import { CardWrapper } from "./card-wrapper";
import type { ContentItem } from "@/lib/db/types";

interface TweetCardProps {
  item: ContentItem & { media_items?: any[] };
}

export function TweetCard({ item }: TweetCardProps) {
  const initials = (item.author_display_name || item.author_handle || "??")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <CardWrapper type="tweet">
      {/* Author */}
      <div className="flex items-center gap-2.5 mb-3">
        {item.author_avatar_url ? (
          <img
            src={item.author_avatar_url}
            alt=""
            className="w-9 h-9 rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2a2a3a] to-[#3a3a4a] flex-shrink-0 flex items-center justify-center text-sm text-[#555566]">
            {initials}
          </div>
        )}
        <div>
          <div className="font-semibold text-sm text-[#f0f0f5]">
            {item.author_display_name || item.author_handle}
          </div>
          {item.author_handle && (
            <div className="text-xs text-[#555566]">@{item.author_handle.replace(/^@/, "")}</div>
          )}
        </div>
      </div>

      {/* Body */}
      <p className="text-sm leading-relaxed text-[#8888aa] line-clamp-3 mb-3">
        {item.body_text}
      </p>

      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-[#555566]">
        <span>Captured {formatTimeAgo(item.created_at)}</span>
        {item.original_url && (
          <a
            href={item.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#8888aa] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
      </div>
    </CardWrapper>
  );
}

function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cards/tweet-card.tsx
git commit -m "feat: create TweetCard component"
```

---

### Task 6: Create thread card

**Files:**
- Create: `components/cards/thread-card.tsx`

- [ ] **Step 1: Create the thread card component**

```tsx
"use client";

import { CardWrapper } from "./card-wrapper";
import type { ContentItem } from "@/lib/db/types";

interface ThreadCardProps {
  item: ContentItem & { media_items?: any[] };
}

export function ThreadCard({ item }: ThreadCardProps) {
  const initials = (item.author_display_name || item.author_handle || "??")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <CardWrapper type="thread">
      {/* Author */}
      <div className="flex items-center gap-2.5 mb-3">
        {item.author_avatar_url ? (
          <img src={item.author_avatar_url} alt="" className="w-9 h-9 rounded-full flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2a2a3a] to-[#3a3a4a] flex-shrink-0 flex items-center justify-center text-sm text-[#555566]">
            {initials}
          </div>
        )}
        <div>
          <div className="font-semibold text-sm text-[#f0f0f5]">{item.author_display_name || item.author_handle}</div>
          {item.author_handle && (
            <div className="text-xs text-[#555566]">@{item.author_handle.replace(/^@/, "")}</div>
          )}
        </div>
      </div>

      {/* Thread indicator */}
      <div className="text-xs text-[var(--accent-thread)] mb-2 flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        Thread
      </div>

      {/* Body */}
      <p className="text-sm leading-relaxed text-[#8888aa] line-clamp-3 mb-3">{item.body_text}</p>

      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-[#555566]">
        <span>Captured {formatTimeAgo(item.created_at)}</span>
        {item.original_url && (
          <a href={item.original_url} target="_blank" rel="noopener noreferrer" className="hover:text-[#8888aa] transition-colors" onClick={(e) => e.stopPropagation()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
          </a>
        )}
      </div>
    </CardWrapper>
  );
}

function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cards/thread-card.tsx
git commit -m "feat: create ThreadCard component with stacked effect"
```

---

### Task 7: Create article card

**Files:**
- Create: `components/cards/article-card.tsx`

- [ ] **Step 1: Create the article card component**

```tsx
"use client";

import { CardWrapper } from "./card-wrapper";
import type { ContentItem } from "@/lib/db/types";

interface ArticleCardProps {
  item: ContentItem & { media_items?: any[] };
}

export function ArticleCard({ item }: ArticleCardProps) {
  const thumbnail = item.media_items?.find((m: any) => m.media_type === "image");
  const sourceDomain = item.original_url
    ? new URL(item.original_url).hostname.replace("www.", "")
    : null;

  return (
    <CardWrapper type="article" noPadding>
      {/* Thumbnail */}
      <div className="w-full h-[140px] rounded-t-[13px] overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
        {thumbnail?.stored_path || thumbnail?.original_url ? (
          <img
            src={thumbnail.stored_path || thumbnail.original_url}
            alt={thumbnail.alt_text || item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xs text-[#555566]">No thumbnail</span>
        )}
      </div>

      <div className="p-4 pt-3">
        {/* Source */}
        {sourceDomain && (
          <div className="text-[11px] text-[var(--accent-article)] uppercase tracking-wider mb-1.5">
            {sourceDomain}
          </div>
        )}

        {/* Title */}
        <h3 className="font-heading font-semibold text-[15px] leading-tight text-[#f0f0f5] mb-1.5 line-clamp-2">
          {item.title}
        </h3>

        {/* Excerpt */}
        <p className="text-sm leading-relaxed text-[#8888aa] line-clamp-2 mb-3">{item.body_text}</p>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-[#555566]">
          <span>{item.author_display_name || item.author_handle}</span>
          <span>Captured {formatTimeAgo(item.created_at)}</span>
        </div>
      </div>
    </CardWrapper>
  );
}

function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cards/article-card.tsx
git commit -m "feat: create ArticleCard component with thumbnail"
```

---

### Task 8: Create art card

**Files:**
- Create: `components/cards/art-card.tsx`

- [ ] **Step 1: Create the art card component**

```tsx
"use client";

import { CardWrapper } from "./card-wrapper";
import type { ContentItem } from "@/lib/db/types";

interface ArtCardProps {
  item: ContentItem & { media_items?: any[] };
}

export function ArtCard({ item }: ArtCardProps) {
  const image = item.media_items?.find((m: any) => m.media_type === "image" || m.media_type === "video");
  const hasImage = !!(image?.stored_path || image?.original_url);

  const initials = (item.author_display_name || item.author_handle || "??")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <CardWrapper type="art" noPadding={hasImage}>
      {/* Image thumbnail (optional) */}
      {hasImage && (
        <div className="w-full h-[180px] rounded-t-[13px] overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#1a1028] to-[#201430] relative">
          <img
            src={image!.stored_path || image!.original_url}
            alt={image!.alt_text || item.title}
            className="w-full h-full object-cover"
          />
          {/* Tool badge */}
          {item.prompt_type && (
            <div className="absolute top-2.5 right-2.5 bg-[#0e101890] backdrop-blur-md border border-[#ec489940] rounded-md px-2 py-0.5 text-[11px] text-[var(--accent-art)] font-medium">
              {item.prompt_type === "image" ? "Image" : "Video"} Prompt
            </div>
          )}
        </div>
      )}

      <div className={hasImage ? "px-5 py-3.5" : "p-5"}>
        {/* Tool badge for no-image cards */}
        {!hasImage && item.prompt_type && (
          <div className="inline-block bg-[#0e101890] border border-[#ec489940] rounded-md px-2 py-0.5 text-[11px] text-[var(--accent-art)] font-medium mb-2.5">
            {item.prompt_type === "image" ? "Image" : "Video"} Prompt
          </div>
        )}

        {/* Prompt text */}
        {item.prompt_text && (
          <p className="text-[13px] text-[#8888aa] italic line-clamp-2 mb-2 before:content-['\201C'] before:text-[var(--accent-art)] after:content-['\201D'] after:text-[var(--accent-art)]">
            {item.prompt_text}
          </p>
        )}

        {/* Author */}
        <div className="flex items-center gap-2 mb-2">
          {item.author_avatar_url ? (
            <img src={item.author_avatar_url} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2a2a3a] to-[#3a3a4a] flex-shrink-0 flex items-center justify-center text-[11px] text-[#555566]">
              {initials}
            </div>
          )}
          <div>
            <div className="font-semibold text-[13px] text-[#f0f0f5]">{item.author_display_name || item.author_handle}</div>
            {item.author_handle && (
              <div className="text-xs text-[#555566]">@{item.author_handle.replace(/^@/, "")}</div>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-[#555566]">
          <span>Captured {formatTimeAgo(item.created_at)}</span>
        </div>
      </div>
    </CardWrapper>
  );
}

function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cards/art-card.tsx
git commit -m "feat: create ArtCard component with tool badge and prompt display"
```

---

### Task 9: Create content card router

**Files:**
- Create: `components/cards/content-card.tsx`

- [ ] **Step 1: Create the router component**

This maps `source_type` to the correct card component.

```tsx
"use client";

import { TweetCard } from "./tweet-card";
import { ThreadCard } from "./thread-card";
import { ArticleCard } from "./article-card";
import { ArtCard } from "./art-card";
import type { ContentItem } from "@/lib/db/types";

interface ContentCardProps {
  item: ContentItem & { media_items?: any[] };
}

export function ContentCard({ item }: ContentCardProps) {
  switch (item.source_type) {
    case "tweet":
      return <TweetCard item={item} />;
    case "thread":
      return <ThreadCard item={item} />;
    case "article":
      return <ArticleCard item={item} />;
    case "image_prompt":
    case "video_prompt":
      return <ArtCard item={item} />;
    default:
      return <TweetCard item={item} />;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/cards/content-card.tsx
git commit -m "feat: create ContentCard router component"
```

---

## Chunk 3: Masonry Feed + API

### Task 10: Create shared query functions

**Files:**
- Create: `lib/db/queries.ts`

- [ ] **Step 1: Create the queries module**

This centralizes data fetching logic used by both the API route and server components.

```tsx
import { prisma } from "./prisma";

export interface FetchItemsOptions {
  limit?: number;
  type?: string;
  excludeIds?: string[];
  search?: string;
}

export async function fetchItems(options: FetchItemsOptions = {}) {
  const { limit = 50, type, excludeIds = [], search } = options;

  const baseWhere: any = {};

  if (type) {
    // Map "art" filter to both image_prompt and video_prompt source types
    if (type === "art") {
      baseWhere.source_type = { in: ["image_prompt", "video_prompt"] };
    } else {
      baseWhere.source_type = type;
    }
  }

  const where = excludeIds.length > 0
    ? { ...baseWhere, id: { notIn: excludeIds } }
    : baseWhere;

  const [items, totalCount] = await Promise.all([
    prisma.contentItem.findMany({
      where,
      include: {
        media_items: true,
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { created_at: "desc" },
      take: limit,
    }),
    prisma.contentItem.count({ where: baseWhere }),
  ]);

  const loadedCount = excludeIds.length + items.length;
  const hasMore = loadedCount < totalCount;

  return { items, hasMore, totalCount };
}

export async function fetchStats() {
  const [total, tweets, threads, articles, art] = await Promise.all([
    prisma.contentItem.count(),
    prisma.contentItem.count({ where: { source_type: "tweet" } }),
    prisma.contentItem.count({ where: { source_type: "thread" } }),
    prisma.contentItem.count({ where: { source_type: "article" } }),
    prisma.contentItem.count({
      where: { source_type: { in: ["image_prompt", "video_prompt"] } },
    }),
  ]);

  return { total, tweets, threads, articles, art };
}

export async function fetchItemById(id: string) {
  return prisma.contentItem.findUnique({
    where: { id },
    include: {
      media_items: true,
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/db/queries.ts
git commit -m "feat: create shared query functions with excludeIds pagination"
```

---

### Task 11: Create stats API route

**Files:**
- Create: `app/api/stats/route.ts`

- [ ] **Step 1: Create the stats endpoint**

```tsx
import { NextResponse } from "next/server";
import { fetchStats } from "@/lib/db/queries";

export async function GET() {
  try {
    const stats = await fetchStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Stats fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/stats/route.ts
git commit -m "feat: create /api/stats endpoint for dashboard counts"
```

---

### Task 12: Update items API route with excludeIds

**Files:**
- Modify: `app/api/items/route.ts`

- [ ] **Step 1: Read the current items route**

Check the existing implementation to understand the current query structure.

- [ ] **Step 2: Update the route to support excludeIds**

Add `excludeIds` as a query parameter (comma-separated list of IDs) and `type` filter. Keep existing functionality intact.

The key change is adding:
```tsx
const excludeIdsParam = searchParams.get("excludeIds");
const excludeIds = excludeIdsParam ? excludeIdsParam.split(",") : [];
const type = searchParams.get("type") || undefined;
```

And replacing the Prisma query to use `fetchItems()` from `lib/db/queries.ts`.

- [ ] **Step 3: Test with curl**

```bash
curl http://localhost:3000/api/items?limit=5 | jq '.items | length'
curl http://localhost:3000/api/stats | jq .
```

- [ ] **Step 4: Commit**

```bash
git add app/api/items/route.ts
git commit -m "feat: add excludeIds pagination and type filtering to items API"
```

---

### Task 13: Create card skeleton

**Files:**
- Create: `components/card-skeleton.tsx`

- [ ] **Step 1: Create skeleton component**

```tsx
"use client";

export function CardSkeleton() {
  return (
    <div className="rounded-[14px] p-px bg-[#ffffff08]">
      <div className="rounded-[13px] bg-[#111118] p-5 animate-pulse">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-full bg-[#1a1a24]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-24 bg-[#1a1a24] rounded" />
            <div className="h-3 w-16 bg-[#1a1a24] rounded" />
          </div>
        </div>
        <div className="space-y-2 mb-3">
          <div className="h-3.5 w-full bg-[#1a1a24] rounded" />
          <div className="h-3.5 w-4/5 bg-[#1a1a24] rounded" />
          <div className="h-3.5 w-3/5 bg-[#1a1a24] rounded" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-20 bg-[#1a1a24] rounded" />
          <div className="h-3 w-4 bg-[#1a1a24] rounded" />
        </div>
      </div>
    </div>
  );
}

export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/card-skeleton.tsx
git commit -m "feat: create card skeleton loading component"
```

---

### Task 14: Create masonry feed component

**Files:**
- Create: `components/masonry-feed.tsx`

Port from `~/Documents/vibecoding/promptsilo/components/masonry-feed.tsx`. Strip admin features (bulk select, delete, category assignment). Keep the core: position calculation, infinite scroll with excludeIds, responsive columns, image load handling.

- [ ] **Step 1: Create masonry-feed.tsx**

```tsx
"use client";

import { ContentCard } from "@/components/cards/content-card";
import { CardSkeletonGrid } from "@/components/card-skeleton";
import { useEffect, useState, useCallback, useTransition, useRef, useLayoutEffect } from "react";
import { useInView } from "react-intersection-observer";
import type { ContentItem } from "@/lib/db/types";

interface MasonryFeedProps {
  initialItems: (ContentItem & { media_items?: any[] })[];
  totalCount: number;
  type?: string;
}

const GAP = 20;

export function MasonryFeed({ initialItems, totalCount: initialTotal, type }: MasonryFeedProps) {
  const [items, setItems] = useState(initialItems);
  const [totalCount, setTotalCount] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialItems.length < initialTotal);
  const [isPending, startTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number; width: number }>>(new Map());
  const [columnCount, setColumnCount] = useState(3);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const calculatedIdsRef = useRef<string>("");

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "1000px",
  });

  // Responsive column count
  const updateColumnCount = useCallback(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.offsetWidth;
    if (width < 640) setColumnCount(1);
    else if (width < 1024) setColumnCount(2);
    else if (width < 1400) setColumnCount(3);
    else if (width < 1800) setColumnCount(4);
    else setColumnCount(5);
  }, []);

  useEffect(() => {
    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);
    return () => window.removeEventListener("resize", updateColumnCount);
  }, [updateColumnCount]);

  // Stable ref for item IDs
  const itemIdsRef = useRef<string[]>([]);
  itemIdsRef.current = items.map((item) => item.id);

  // Position calculation
  const calculatePositions = useCallback(() => {
    if (!containerRef.current || itemIdsRef.current.length === 0) return;

    const containerWidth = containerRef.current.offsetWidth;
    const columnWidth = (containerWidth - GAP * (columnCount - 1)) / columnCount;
    const columnHeights = new Array(columnCount).fill(0);
    const newPositions = new Map<string, { x: number; y: number; width: number }>();

    itemIdsRef.current.forEach((id) => {
      const element = itemRefs.current.get(id);
      if (!element) return;

      const shortestColumn = columnHeights.indexOf(Math.min(...columnHeights));
      const x = shortestColumn * (columnWidth + GAP);
      const y = columnHeights[shortestColumn];

      newPositions.set(id, { x, y, width: columnWidth });
      columnHeights[shortestColumn] = y + element.offsetHeight + GAP;
    });

    setPositions(newPositions);
    setContainerHeight(Math.max(...columnHeights));
  }, [columnCount]);

  const layoutKey = `${items.map((i) => i.id).join(",")}_${columnCount}`;

  useLayoutEffect(() => {
    if (calculatedIdsRef.current === layoutKey) return;
    const timer = setTimeout(() => {
      calculatePositions();
      calculatedIdsRef.current = layoutKey;
    }, 100);
    return () => clearTimeout(timer);
  }, [layoutKey, calculatePositions]);

  // Recalculate on image load (debounced)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let debounceTimer: NodeJS.Timeout | null = null;

    const handleImageLoad = (e: Event) => {
      if (e.target instanceof HTMLImageElement) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => calculatePositions(), 100);
      }
    };

    container.addEventListener("load", handleImageLoad, true);
    return () => {
      container.removeEventListener("load", handleImageLoad, true);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [calculatePositions]);

  // Load more via API with excludeIds
  const loadMore = useCallback(() => {
    if (!hasMore || isPending) return;

    startTransition(async () => {
      const loadedIds = items.map((i) => i.id);
      const params = new URLSearchParams({
        limit: "50",
        excludeIds: loadedIds.join(","),
      });
      if (type) params.set("type", type);

      const res = await fetch(`/api/items?${params}`);
      const data = await res.json();

      const newItems = data.items.filter(
        (item: any) => !loadedIds.includes(item.id)
      );

      setItems((prev) => [...prev, ...newItems]);
      setHasMore(data.hasMore);
      setTotalCount(data.totalCount);
    });
  }, [hasMore, isPending, items, type]);

  useEffect(() => {
    if (inView && hasMore && !isPending) loadMore();
  }, [inView, loadMore, hasMore, isPending]);

  // Reset on type filter change
  const prevTypeRef = useRef(type);
  useEffect(() => {
    if (prevTypeRef.current !== type) {
      prevTypeRef.current = type;
      setItems(initialItems);
      setHasMore(initialItems.length < initialTotal);
      setTotalCount(initialTotal);
      setPositions(new Map());
      calculatedIdsRef.current = "";
    }
  }, [type, initialItems, initialTotal]);

  const setItemRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="relative"
        style={{ height: containerHeight > 0 ? containerHeight : "auto" }}
      >
        {items.map((item) => {
          const pos = positions.get(item.id);
          return (
            <div
              key={item.id}
              ref={(el) => setItemRef(item.id, el)}
              style={
                pos
                  ? { position: "absolute", left: pos.x, top: pos.y, width: pos.width }
                  : { position: "absolute", opacity: 0, width: `calc((100% - ${GAP * (columnCount - 1)}px) / ${columnCount})` }
              }
            >
              <ContentCard item={item} />
            </div>
          );
        })}
      </div>

      {isPending && (
        <div className="mt-4">
          <CardSkeletonGrid count={6} />
        </div>
      )}

      {hasMore && <div ref={ref} className="h-4" />}

      {!hasMore && items.length > 0 && (
        <div className="flex justify-center py-8">
          <span className="text-sm text-[#555566]">You've reached the end</span>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/masonry-feed.tsx
git commit -m "feat: create MasonryFeed with excludeIds infinite scroll (ported from promptsilo)"
```

---

## Chunk 4: Search, Filters, Stats, Home Page

### Task 15: Create search bar component

**Files:**
- Create: `components/search-bar.tsx`

- [ ] **Step 1: Create the gradient-bordered search bar**

```tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        router.push(`/?q=${encodeURIComponent(query.trim())}`);
      } else {
        router.push("/");
      }
    },
    [query, router]
  );

  return (
    <form onSubmit={handleSearch} className="w-full max-w-[640px]">
      <div className="p-px rounded-[14px] search-border-gradient opacity-50 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
        <div className="flex items-center bg-[#1a1a24] rounded-[13px] h-14 px-5 gap-3 w-full">
          <svg className="text-[#555566] flex-shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your captures..."
            className="flex-1 bg-transparent border-none outline-none text-[#f0f0f5] font-sans text-base placeholder:text-[#555566]"
          />
          <span className="text-xs text-[#555566] bg-[#0a0a0f] px-2 py-1 rounded-md border border-[#ffffff12]">
            &#8984;K
          </span>
        </div>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/search-bar.tsx
git commit -m "feat: create SearchBar with gradient border"
```

---

### Task 16: Create stat pills and filter pills

**Files:**
- Create: `components/stat-pills.tsx`
- Create: `components/filter-pills.tsx`

- [ ] **Step 1: Create stat-pills.tsx**

```tsx
interface StatPillsProps {
  stats: { total: number; tweets: number; threads: number; articles: number; art: number };
}

export function StatPills({ stats }: StatPillsProps) {
  const pills = [
    { label: "Tweets", count: stats.tweets, color: "bg-[var(--accent-tweet)]" },
    { label: "Threads", count: stats.threads, color: "bg-[var(--accent-thread)]" },
    { label: "Articles", count: stats.articles, color: "bg-[var(--accent-article)]" },
    { label: "Art", count: stats.art, color: "bg-[var(--accent-art)]" },
  ];

  return (
    <div className="flex gap-3 flex-wrap justify-center">
      {pills.map((pill) => (
        <div
          key={pill.label}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#111118] border border-[#ffffff12] text-[13px] text-[#8888aa]"
        >
          <span className={`w-2 h-2 rounded-full ${pill.color}`} />
          <span className="font-semibold text-[#f0f0f5]">{pill.count.toLocaleString()}</span>
          {pill.label}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create filter-pills.tsx**

```tsx
"use client";

import { cn } from "@/lib/utils";

interface FilterPillsProps {
  activeType: string;
  onTypeChange: (type: string) => void;
}

const filters = [
  { label: "All", value: "" },
  { label: "Tweets", value: "tweet" },
  { label: "Threads", value: "thread" },
  { label: "Articles", value: "article" },
  { label: "Art", value: "art" },
];

export function FilterPills({ activeType, onTypeChange }: FilterPillsProps) {
  return (
    <div className="flex gap-2 justify-center">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => onTypeChange(f.value)}
          className={cn(
            "px-4 py-1.5 rounded-2xl text-[13px] border transition-all cursor-pointer",
            activeType === f.value
              ? "bg-[#1a1a24] border-[#ffffff24] text-[#f0f0f5]"
              : "bg-[#111118] border-[#ffffff12] text-[#8888aa] hover:border-[#ffffff18]"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/stat-pills.tsx components/filter-pills.tsx
git commit -m "feat: create StatPills and FilterPills components"
```

---

### Task 17: Create home page (client component)

**Files:**
- Create: `components/home-page.tsx`

- [ ] **Step 1: Create the home page client wrapper**

```tsx
"use client";

import { useState } from "react";
import { SearchBar } from "@/components/search-bar";
import { StatPills } from "@/components/stat-pills";
import { FilterPills } from "@/components/filter-pills";
import { MasonryFeed } from "@/components/masonry-feed";
import type { ContentItem } from "@/lib/db/types";

interface HomePageProps {
  initialItems: (ContentItem & { media_items?: any[] })[];
  totalCount: number;
  stats: { total: number; tweets: number; threads: number; articles: number; art: number };
}

export function HomePage({ initialItems, totalCount, stats }: HomePageProps) {
  const [activeType, setActiveType] = useState("");

  return (
    <div className="relative z-10 max-w-[960px] mx-auto px-6">
      {/* Header */}
      <header className="flex items-center justify-between py-6">
        <div className="font-heading font-semibold text-[21px] tracking-tight text-[#f0f0f5] flex items-center">
          feed<span className="inline-block w-[5px] h-[5px] rounded-full bg-[var(--accent-thread)] mx-[1px] relative top-[1px]" />silo
        </div>
        <div className="text-[13px] text-[#555566]">{stats.total.toLocaleString()} captures</div>
      </header>

      {/* Hero */}
      <div className="flex flex-col items-center pt-20 pb-10 text-center">
        <h1 className="font-heading text-5xl font-extrabold tracking-[-1.8px] leading-[1.08] mb-3">
          Your digital<br />knowledge, searchable.
        </h1>
        <p className="text-[#8888aa] text-[17px] mb-10 max-w-[480px]">
          Capture tweets, threads, and articles. Find anything instantly with hybrid search.
        </p>

        <SearchBar />

        <div className="mt-6">
          <StatPills stats={stats} />
        </div>

        <div className="mt-5">
          <FilterPills activeType={activeType} onTypeChange={setActiveType} />
        </div>
      </div>

      {/* Feed */}
      <div className="flex items-center justify-between mb-5 mt-12">
        <h2 className="font-heading text-xl font-semibold">Recent Captures</h2>
        <span className="text-[13px] text-[#555566]">
          {totalCount.toLocaleString()} items
        </span>
      </div>

      <div className="pb-16">
        <MasonryFeed
          key={activeType}
          initialItems={initialItems}
          totalCount={totalCount}
          type={activeType || undefined}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/home-page.tsx
git commit -m "feat: create HomePage client wrapper with search, stats, filters, and masonry feed"
```

---

### Task 18: Wire up the server-side home page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Read current page.tsx**

Check existing contents.

- [ ] **Step 2: Replace with server component that fetches data**

```tsx
import { HomePage } from "@/components/home-page";
import { fetchItems, fetchStats } from "@/lib/db/queries";

export default async function Home() {
  const [{ items, totalCount }, stats] = await Promise.all([
    fetchItems({ limit: 50 }),
    fetchStats(),
  ]);

  return (
    <main className="min-h-screen">
      <HomePage
        initialItems={JSON.parse(JSON.stringify(items))}
        totalCount={totalCount}
        stats={stats}
      />
    </main>
  );
}
```

Note: `JSON.parse(JSON.stringify(items))` serializes Prisma objects (with Date fields) for the client component.

- [ ] **Step 3: Run the dev server and verify**

```bash
npm run dev
```

Open http://localhost:3000 — should see the full home page with masonry feed (empty if no data, but layout should render).

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire up server-side data fetching for home page"
```

---

## Chunk 5: Single Item Page + Gallery Placeholder

### Task 19: Build single item detail page

**Files:**
- Modify: `app/item/[id]/page.tsx`

- [ ] **Step 1: Read current item page**

Check what's there already.

- [ ] **Step 2: Build the full detail view**

```tsx
import { notFound } from "next/navigation";
import { fetchItemById } from "@/lib/db/queries";
import Link from "next/link";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await fetchItemById(id);

  if (!item) notFound();

  const sourceDomain = item.original_url
    ? new URL(item.original_url).hostname.replace("www.", "")
    : null;

  const isArt = item.source_type === "image_prompt" || item.source_type === "video_prompt";

  return (
    <main className="min-h-screen">
      <div className="relative z-10 max-w-[720px] mx-auto px-6 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[#555566] hover:text-[#8888aa] transition-colors mb-8"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        {/* Author header */}
        <div className="flex items-center gap-3 mb-6">
          {item.author_avatar_url ? (
            <img src={item.author_avatar_url} alt="" className="w-12 h-12 rounded-full" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2a2a3a] to-[#3a3a4a] flex items-center justify-center text-lg text-[#555566]">
              {(item.author_display_name || item.author_handle || "?")[0].toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-semibold text-[#f0f0f5]">
              {item.author_display_name || item.author_handle}
            </div>
            {item.author_handle && (
              <div className="text-sm text-[#555566]">@{item.author_handle.replace(/^@/, "")}</div>
            )}
          </div>
          {sourceDomain && (
            <span className="ml-auto text-xs text-[#555566] bg-[#111118] border border-[#ffffff12] rounded-md px-2 py-1">
              {sourceDomain}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="font-heading text-2xl font-bold tracking-tight mb-4">{item.title}</h1>

        {/* Art prompt */}
        {isArt && item.prompt_text && (
          <blockquote className="text-[#8888aa] italic border-l-2 border-[var(--accent-art)] pl-4 mb-6">
            {item.prompt_text}
          </blockquote>
        )}

        {/* Media */}
        {item.media_items && item.media_items.length > 0 && (
          <div className="mb-6 space-y-4">
            {item.media_items.map((media: any) => (
              <div key={media.id} className="rounded-xl overflow-hidden">
                {media.media_type === "video" ? (
                  <video
                    src={media.stored_path || media.original_url}
                    controls
                    className="w-full rounded-xl"
                  />
                ) : (
                  <img
                    src={media.stored_path || media.original_url}
                    alt={media.alt_text || ""}
                    className="w-full rounded-xl"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="prose prose-invert max-w-none text-[#c0c0d0] leading-relaxed">
          {item.body_html ? (
            <div dangerouslySetInnerHTML={{ __html: item.body_html }} />
          ) : (
            <div className="whitespace-pre-wrap">{item.body_text}</div>
          )}
        </div>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-8">
            {item.tags.map((ct: any) => (
              <span key={ct.tag.id} className="text-xs bg-[#111118] border border-[#ffffff12] rounded-full px-3 py-1 text-[#8888aa]">
                {ct.tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Original link */}
        {item.original_url && (
          <div className="mt-8 pt-6 border-t border-[#ffffff12]">
            <a
              href={item.original_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--accent-tweet)] hover:underline"
            >
              View original &rarr;
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/item/[id]/page.tsx
git commit -m "feat: build single item detail page with full content view"
```

---

### Task 20: Create gallery placeholder page

**Files:**
- Modify: `app/archive/page.tsx` (rename purpose to gallery)

- [ ] **Step 1: Update archive page as gallery placeholder**

```tsx
import Link from "next/link";

export default function GalleryPage() {
  return (
    <main className="min-h-screen">
      <div className="relative z-10 max-w-[960px] mx-auto px-6 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[#555566] hover:text-[#8888aa] transition-colors mb-8"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <h1 className="font-heading text-3xl font-bold tracking-tight mb-4">Art Gallery</h1>
        <p className="text-[#8888aa]">
          Gallery view for AI-generated art coming in Session 3.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/archive/page.tsx
git commit -m "feat: update archive page as gallery placeholder"
```

---

### Task 21: Add click-through navigation from cards to detail page

**Files:**
- Modify: `components/cards/card-wrapper.tsx`

- [ ] **Step 1: Read current card-wrapper.tsx**

- [ ] **Step 2: Wrap the CardWrapper in a Next.js Link**

Update `CardWrapper` to accept an `href` prop and wrap content in a Link:

```tsx
import Link from "next/link";
```

Add `href?: string` to the interface, and wrap the outer div with:

```tsx
const Wrapper = href ? Link : "div";
const wrapperProps = href ? { href } : {};
```

- [ ] **Step 3: Update ContentCard to pass the href**

In `components/cards/content-card.tsx`, pass `href={`/item/${item.id}`}` to each card variant, and update each card to accept and forward the `href` to `CardWrapper`.

- [ ] **Step 4: Commit**

```bash
git add components/cards/card-wrapper.tsx components/cards/content-card.tsx components/cards/tweet-card.tsx components/cards/thread-card.tsx components/cards/article-card.tsx components/cards/art-card.tsx
git commit -m "feat: add click-through navigation from cards to detail page"
```

---

### Task 22: Final build verification

- [ ] **Step 1: Run the full build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run existing tests**

```bash
npm run test
```

Expected: All existing tests pass (hybrid search tests).

- [ ] **Step 3: Start dev server and manually verify**

```bash
npm run dev
```

Verify at http://localhost:3000:
- Home page renders with header (feed·silo logo), hero, search bar, stat pills, filter pills
- Masonry feed shows cards (or empty state if no data)
- Filter pills switch between types
- Clicking a card navigates to `/item/[id]`
- Infinite scroll loads more items
- Single item page shows full content

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Session 2 frontend UI implementation"
```
