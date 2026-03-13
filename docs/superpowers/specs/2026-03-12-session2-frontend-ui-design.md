# FeedSilo Session 2: Frontend UI Design Spec

## Overview

Build the frontend UI for FeedSilo — a dark-themed content dashboard that displays captured tweets, threads, articles, and AI art in a masonry-scrolling feed with hybrid search.

## Typography & Branding

- **Heading font:** Plus Jakarta Sans (weights 200–800)
- **Body font:** DM Sans
- **Logo:** lowercase `feed·silo` with purple dot separator (#a78bfa), Plus Jakarta Sans 600 weight
- **Hero heading:** "Your digital knowledge, searchable." — Plus Jakarta Sans 800, -1.8px letter-spacing

## Color System

### Base Theme (Dark)
| Token | Value |
|-------|-------|
| `--background` | `#0a0a0f` |
| `--surface` | `#111118` |
| `--surface-elevated` | `#1a1a24` |
| `--text-primary` | `#f0f0f5` |
| `--text-secondary` | `#8888aa` |
| `--text-muted` | `#555566` |
| `--border` | `#ffffff12` |

### Content Type Accents
| Type | Color | CSS Variable |
|------|-------|-------------|
| Tweet | `#22d3ee` (cyan) | `--accent-tweet` |
| Thread | `#a78bfa` (purple) | `--accent-thread` |
| Article | `#fb923c` (orange) | `--accent-article` |
| Art | `#ec4899` (pink) | `--accent-art` |

## Card Gradient System

Each card uses a 7-layer radial gradient background creating a diagonal color band from upper-right to lower-left:

1. **Dark wash bottom edge** — `linear-gradient(to top, #0e1018 0%, transparent 40%)`
2. **Dark wash upper-left corner** — `radial-gradient(ellipse at 0% 0%, #0e1018, transparent 50%)`
3. **Dark wash lower-right corner** — `radial-gradient(ellipse at 100% 100%, #0e1018, transparent 8%)`
4. **Tiny warm hot spot** — `radial-gradient(circle at 97% 3%, [accent-warm], transparent 14%)` — 3% radius
5. **Dominant color band** — `radial-gradient(ellipse at 78% 15%, [accent-deep], transparent 45%)`
6. **Blue center** — `radial-gradient(ellipse at 50% 40%, [blue], transparent 55%)`
7. **Teal lower** — `radial-gradient(ellipse at 40% 60%, [teal], transparent 55%)`
8. **Fallback** — `#0e1018`

Each card type substitutes different colors into this template. Cards have a 1px gradient border via an outer wrapper with `padding: 1px` and `border-radius: 14px/13px`.

### Per-Type Gradient Colors
- **Tweet:** orange tip → purple → blue → teal
- **Thread:** rose tip → magenta → purple → cyan-teal
- **Article:** amber tip → olive-green → blue → indigo
- **Art:** pink tip → deep magenta → purple → blue

## Page Structure

### Home Page

```
[header: logo | capture count]
[hero: heading + subtitle]
[search bar with 4-color gradient border]
[stat pills: Tweets | Threads | Articles | Art]
[filter pills: All | Tweets | Threads | Articles | Art]
[section header: "Recent Captures" | "View all →"]
[masonry feed grid]
```

### Single Item Page (planned)
- Full content view with metadata sidebar
- Related items section via vector similarity (`GET /api/items/[id]/related`)

### Gallery Page (placeholder)
- Grid view for art-type content items

## Masonry Feed

Port the masonry implementation from `~/Documents/vibecoding/promptsilo`:

### Architecture
- **Custom absolute positioning** — manual column height calculation, not CSS masonry
- **`excludeIds` pagination** — instead of offset-based pagination, sends all previously-loaded item IDs to the server; API returns `{ items, hasMore, totalCount }` filtering with `id: { notIn: excludeIds }`
- **`react-intersection-observer`** — triggers loading 1000px before scroll bottom
- **Responsive columns:** 1 (mobile) → 2 (tablet) → 3 (desktop) → 4-5 (wide)

### Key Source Files to Port
- `~/Documents/vibecoding/promptsilo/components/masonry-feed.tsx` — layout engine + infinite scroll
- Adapt `fetchPrompts()` excludeIds pattern to FeedSilo's Prisma queries

### Why This Approach
- Eliminates duplicate items during infinite scroll (the core problem with offset pagination)
- Stable layout — items don't shift as new content loads
- No heavy library dependency — pure React position calculation

## Card Components

### Tweet Card
- Author avatar + name + handle
- Body text (3-line clamp)
- Engagement stats, capture timestamp

### Thread Card
- Same as tweet + thread indicator (tweet count)
- Stacked card effect (pseudo-elements behind bottom edge)

### Article Card
- Thumbnail image area (top)
- Source domain label (uppercase)
- Article title (Plus Jakarta Sans 600)
- Excerpt (2-line clamp)
- Author + timestamp

### Art Card
- Image thumbnail (180px, optional — card works without it)
- AI tool badge (positioned top-right, frosted glass)
- Prompt text in styled quotes with pink quote marks
- Author + timestamp

## Search Experience

- Gradient-bordered search bar (4-color: cyan → purple → pink → orange)
- Fades to 50% opacity when idle, full opacity on hover/focus
- `Cmd+K` keyboard shortcut badge
- Placeholder: "Search your captures..."
- Backed by existing hybrid search (full-text + vector) from Session 1

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/items` | GET | Paginated list with filtering, search, excludeIds |
| `/api/items/[id]` | GET | Single item detail |
| `/api/items/[id]/related` | GET | Vector-similar items |
| `/api/stats` | GET | Dashboard counts by type |

## Dependencies to Add

- `react-intersection-observer` — infinite scroll trigger
- `framer-motion` — card entrance animations
- `plus-jakarta-sans` (Google Fonts or `@fontsource/plus-jakarta-sans`)

## Scope Boundaries

- **Session 2 (this spec):** Frontend UI — home page, masonry feed, card components, single item page, gallery placeholder, search, animations
- **Session 3 (future):** DB migration for `ai_tool` + `ai_model_version` columns, Gemini multimodal art enrichment parser

## Background Effects

- Subtle purple radial glow (`#7c3aed12`) centered on page
- Teal secondary glow offset right
- Noise texture overlay at 3% opacity
- No external box-shadows on cards

## Visual Mockup

See `.superpowers/brainstorm/8783-1773344881/home-design.html` for the full interactive mockup.
