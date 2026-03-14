# Admin Panel + Authentication Design

## Overview

Add authentication and admin capabilities to FeedSilo. Read-only access (feed, detail pages, search) remains public. All mutation operations (settings, data changes, admin) require login.

## Authentication

### Stack
- **NextAuth v5 (Auth.js)** with Credentials provider
- **JWT session strategy** (no session table needed)
- Single admin user — email + bcrypt-hashed password in a `User` table

### User Table (Prisma)
```prisma
model User {
  id             String   @id @default(uuid()) @db.Uuid
  email          String   @unique
  password_hash  String
  created_at     DateTime @default(now())
}
```

### Account Creation
- During onboarding flow (or one-time setup if already onboarded): create admin account with email + password
- No registration page — single user only

### Login
- `/login` page — dark-themed, matches existing aesthetic
- Redirects to home after successful login
- Shows login link in nav when not authenticated

### Protection Model (Middleware)
- **Public (no auth):** All `GET` requests — feed, detail pages, search, API reads
- **Protected (session required):** `/settings`, `/admin`, all `POST/PUT/DELETE` API routes
- **Exception:** `/api/extension/capture` and `/api/extension/capture/bulk` remain Bearer-token protected (extension can't use session cookies)
- **Exception:** `/api/setup/*` routes remain public (needed for onboarding)

## Admin Table (`/admin`)

### Layout
Full-width data table with search, filters, and bulk operations.

### Top Bar
- Search input (searches body_text, title, author)
- Filter dropdowns: source_type, author
- "Add Item" button

### Table Columns
| Checkbox | Thumbnail | Title/Body preview | Author | Type | Date | Actions |

### Bulk Actions Bar
Appears when items are selected:
- "Delete Selected" button
- "Re-process Selected" button
- Count indicator ("3 items selected")

### Pagination
- Server-side, 50 items per page
- Page controls at bottom

### Selection Behavior
- Click checkbox to toggle single item
- Shift-click for range selection
- "Select all on page" checkbox in header

### UI Components (shadcn/ui)
Install: Table, Dialog, DropdownMenu, Checkbox, Input, Select, Badge, AlertDialog

## Item Edit

### Entry Points
1. Admin table — edit button in actions column → dialog/modal
2. Detail page sidebar — pencil icon (visible only when logged in) → same dialog

### Editable Fields
- `source_type` — dropdown (tweet, thread, article, image_prompt, video_prompt)
- `author_handle` — text input
- `author_display_name` — text input
- `title` — text input
- `body_text` — textarea
- `source_url` — text input
- `posted_at` — date picker

### Non-Editable (System-Managed)
id, external_id, conversation_id, embeddings, search_vector, created_at

### On Save
- Update the item in the database
- Regenerate search vector (tsvector) for updated body/title
- Embedding regeneration optional via separate "Re-embed" button

## Manual Capture

### Entry Point
"Add Item" button on admin table → form dialog

### Required Fields
At least one of: `source_url` OR `body_text`

### Optional Fields
`source_type`, `author_handle`, `title`, `posted_at`, `media_urls`

### Processing
Submits to existing `ingestItem()` — gets auto-classification, tagging, and embedding like extension captures.

## Re-process

### Entry Points
- Single item: actions dropdown on admin table, or button on detail page sidebar
- Bulk: select items → "Re-process Selected" in bulk actions bar

### Operations
- Re-classify source_type
- Regenerate search vector (tsvector)
- Regenerate embedding (Gemini)

### UX
Runs async — toast/progress indicator, non-blocking.

## Detail Page Changes

When authenticated, the detail sidebar gains:
- **Edit** button (opens edit dialog)
- **Delete** button (with confirmation AlertDialog)
- **Re-process** button

These buttons are hidden for unauthenticated (public) visitors.

## Route Structure (New/Modified)

```
/login                → Login page (new)
/admin                → Admin table (new, protected)
/api/auth/[...nextauth] → NextAuth routes (new)
/api/admin/items      → GET (paginated, filterable), DELETE (bulk)
/api/admin/items/[id] → PUT (edit), DELETE (single)
/api/admin/items/[id]/reprocess → POST
/api/admin/items/manual → POST (manual capture)
```

## Dependencies
- `next-auth@5` (Auth.js)
- `bcryptjs` (password hashing)
- shadcn/ui components: table, dialog, dropdown-menu, checkbox, input, select, badge, alert-dialog
