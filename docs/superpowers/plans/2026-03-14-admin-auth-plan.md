# Admin Panel + Authentication Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add NextAuth authentication and a full admin panel with CRUD operations to FeedSilo, keeping read-only access public.

**Architecture:** NextAuth v5 with Credentials provider and JWT sessions. Single admin user created during onboarding. Middleware protects mutation routes and admin/settings pages. Admin table at `/admin` with shadcn/ui data table for bulk operations. Edit/delete/reprocess actions on both admin table and detail page sidebar.

**Tech Stack:** NextAuth v5, bcryptjs, shadcn/ui (table, dialog, dropdown-menu, checkbox, input, select, badge, alert-dialog), Prisma, Next.js 14 App Router

---

## File Structure

### New Files
- `prisma/migrations/XXXX_add_user_table/migration.sql` — User table migration
- `lib/auth/auth.ts` — NextAuth configuration (providers, callbacks, session)
- `lib/auth/session.ts` — Helper: `requireAuth()` for API routes
- `app/api/auth/[...nextauth]/route.ts` — NextAuth route handler
- `app/login/page.tsx` — Login page (server component wrapper)
- `components/login/login-form.tsx` — Login form (client component)
- `app/admin/page.tsx` — Admin page (server component wrapper)
- `components/admin/admin-page.tsx` — Admin page (client component)
- `components/admin/data-table.tsx` — Data table with selection, sorting, pagination
- `components/admin/columns.tsx` — Column definitions for the data table
- `components/admin/bulk-actions-bar.tsx` — Bulk delete/reprocess bar
- `components/admin/item-edit-dialog.tsx` — Edit item dialog (shared between admin + detail)
- `components/admin/manual-capture-dialog.tsx` — Manual capture form dialog
- `components/admin/delete-confirm-dialog.tsx` — Delete confirmation dialog
- `components/detail/admin-actions.tsx` — Auth-gated edit/delete/reprocess buttons for detail sidebar
- `app/api/admin/items/route.ts` — GET (paginated list), DELETE (bulk)
- `app/api/admin/items/[id]/route.ts` — PUT (edit), DELETE (single)
- `app/api/admin/items/[id]/reprocess/route.ts` — POST (reprocess)
- `app/api/admin/items/manual/route.ts` — POST (manual capture)
- `app/api/admin/setup/route.ts` — POST (create admin account, used by onboarding)
- `components/ui/table.tsx` — shadcn/ui table component
- `components/ui/dialog.tsx` — shadcn/ui dialog component
- `components/ui/dropdown-menu.tsx` — shadcn/ui dropdown-menu
- `components/ui/checkbox.tsx` — shadcn/ui checkbox
- `components/ui/input.tsx` — shadcn/ui input
- `components/ui/select.tsx` — shadcn/ui select
- `components/ui/badge.tsx` — shadcn/ui badge
- `components/ui/alert-dialog.tsx` — shadcn/ui alert-dialog
- `components/ui/label.tsx` — shadcn/ui label
- `components/ui/textarea.tsx` — shadcn/ui textarea

### Modified Files
- `prisma/schema.prisma` — Add User model
- `middleware.ts` — Add auth checks for mutations + protected pages
- `app/layout.tsx` — Wrap with SessionProvider
- `components/header.tsx` — Add login/logout link + admin link
- `components/detail/detail-sidebar.tsx` — Add admin actions (auth-gated)
- `components/onboarding/onboarding-page.tsx` — Add account creation step
- `package.json` — Add next-auth, bcryptjs dependencies

---

## Chunk 1: Foundation — Dependencies, Schema, Auth Config

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install next-auth and bcryptjs**

```bash
cd /Users/richgates/Documents/vibecoding/feedsilo
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Install shadcn/ui components**

```bash
npx shadcn@latest add table dialog dropdown-menu checkbox input select badge alert-dialog label textarea
```

- [ ] **Step 3: Verify installation**

```bash
ls components/ui/table.tsx components/ui/dialog.tsx components/ui/checkbox.tsx components/ui/input.tsx
```
Expected: All files exist

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json components/ui/
git commit -m "chore: install next-auth, bcryptjs, shadcn/ui components"
```

### Task 2: Add User model to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add User model**

Add to `prisma/schema.prisma` after the XApiConnection model:

```prisma
model User {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email         String   @unique @db.Text
  password_hash String   @db.Text
  created_at    DateTime @default(now()) @db.Timestamptz(6)

  @@map("users")
}
```

- [ ] **Step 2: Push schema to database**

```bash
npx prisma db push --schema=prisma/schema.prisma --accept-data-loss --skip-generate
```
Expected: User table created

- [ ] **Step 3: Regenerate Prisma client**

```bash
npm run prisma:generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add User model to Prisma schema"
```

### Task 3: Configure NextAuth

**Files:**
- Create: `lib/auth/auth.ts`
- Create: `lib/auth/session.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create auth configuration**

Create `lib/auth/auth.ts`:

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        );

        if (!valid) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
});
```

- [ ] **Step 2: Create session helper**

Create `lib/auth/session.ts`:

```typescript
import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";

/**
 * Require auth for API route handlers. Returns 401 if not authenticated.
 * Usage: const session = await requireAuth(); if (session instanceof NextResponse) return session;
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}
```

- [ ] **Step 3: Create NextAuth route handler**

Create `app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@/lib/auth/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 4: Add NEXTAUTH_SECRET to .env**

Add to `.env` (generate a random secret):

```
NEXTAUTH_SECRET=<generate-random-32-char-string>
```

Also add to `.env.example`:
```
NEXTAUTH_SECRET=your-secret-here
```

- [ ] **Step 5: Commit**

```bash
git add lib/auth/auth.ts lib/auth/session.ts app/api/auth/\[...nextauth\]/route.ts .env.example
git commit -m "feat: configure NextAuth v5 with Credentials provider"
```

### Task 4: Update middleware for auth protection

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Rewrite middleware**

Replace `middleware.ts` with auth-aware version:

```typescript
import { NextRequest, NextResponse } from "next/server";

// Pages that require authentication
const PROTECTED_PAGES = ["/settings", "/admin"];

// API routes that use their own auth (Bearer token)
const EXTENSION_API_PATHS = [
  "/api/extension/",
  "/api/ingest/",
];

// API routes that are always public
const PUBLIC_API_PATHS = [
  "/api/auth/",      // NextAuth routes
  "/api/setup/",     // Onboarding
  "/api/stats",      // Stats for home page
  "/api/items",      // Public feed API
  "/api/search",     // Public search
  "/api/r2/",        // Media proxy
];

// Static/framework paths — skip entirely
const SKIP_PATHS = ["/_next", "/favicon.ico"];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const method = request.method;

  // Skip framework paths
  if (SKIP_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Onboarding check (existing logic)
  if (!pathname.startsWith("/onboarding") && !pathname.startsWith("/api/")) {
    const hasEnv = process.env.DATABASE_URL && process.env.DATABASE_TYPE;
    const configured = request.cookies.get("feedsilo-configured");
    if (!hasEnv && configured?.value !== "true") {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  // Extension API routes — handled by their own Bearer token auth
  if (EXTENSION_API_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Public API routes — always allowed
  if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) {
    // Allow GET on these paths; POST/PUT/DELETE on non-public APIs need auth
    if (method === "GET") return NextResponse.next();
  }

  // Check if this request needs auth
  const needsAuth =
    PROTECTED_PAGES.some((p) => pathname.startsWith(p)) ||
    (pathname.startsWith("/api/") && method !== "GET");

  if (!needsAuth) {
    return NextResponse.next();
  }

  // Check for NextAuth session token
  const sessionToken =
    request.cookies.get("__Secure-authjs.session-token") ||
    request.cookies.get("authjs.session-token");

  if (!sessionToken) {
    // API routes return 401, pages redirect to login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

Note: Middleware only checks for the presence of the session cookie — actual JWT validation happens in `auth()` calls within route handlers. This is the standard NextAuth pattern.

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: auth-aware middleware protecting mutations and admin pages"
```

### Task 5: Add SessionProvider to layout + update header

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/header.tsx`

- [ ] **Step 1: Create session provider wrapper**

Create `components/session-provider.tsx`:

```typescript
"use client";

import { SessionProvider } from "next-auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 2: Wrap layout with SessionProvider**

In `app/layout.tsx`, import and wrap the body content:

```typescript
import { AuthProvider } from "@/components/session-provider";
```

Wrap children inside `<body>`:
```tsx
<body className={...}>
  <AuthProvider>
    {children}
  </AuthProvider>
</body>
```

- [ ] **Step 3: Update header with login/admin links**

In `components/header.tsx`, add auth-aware navigation:

- Import `useSession`, `signOut` from `next-auth/react`
- When authenticated: show "Admin" link + "Logout" button + settings gear
- When not authenticated: show "Login" link + settings gear (settings will redirect to login)

- [ ] **Step 4: Commit**

```bash
git add components/session-provider.tsx app/layout.tsx components/header.tsx
git commit -m "feat: SessionProvider wrapper + auth-aware header navigation"
```

---

## Chunk 2: Login Page + Account Creation

### Task 6: Create login page

**Files:**
- Create: `app/login/page.tsx`
- Create: `components/login/login-form.tsx`

- [ ] **Step 1: Create login page server component**

Create `app/login/page.tsx`:

```typescript
import { LoginForm } from "@/components/login/login-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Login — FeedSilo" };

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <LoginForm />
    </div>
  );
}
```

- [ ] **Step 2: Create login form client component**

Create `components/login/login-form.tsx`:

Dark-themed login form matching existing aesthetic:
- Email + password inputs
- Submit button
- Error message display
- Uses `signIn("credentials", ...)` from next-auth/react
- Redirects to callbackUrl or "/" on success
- Styled with existing dark theme (bg-[var(--surface)], border, rounded-[14px])

- [ ] **Step 3: Test login page renders**

Navigate to `http://localhost:3000/login` — should see the login form.

- [ ] **Step 4: Commit**

```bash
git add app/login/ components/login/
git commit -m "feat: login page with dark-themed credential form"
```

### Task 7: Admin account creation in onboarding

**Files:**
- Create: `app/api/admin/setup/route.ts`
- Modify: `components/onboarding/onboarding-page.tsx`

- [ ] **Step 1: Create admin setup API**

Create `app/api/admin/setup/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Email and password (min 8 chars) required" },
      { status: 400 }
    );
  }

  // Only allow if no users exist yet (first-time setup)
  const existingCount = await prisma.user.count();
  if (existingCount > 0) {
    return NextResponse.json(
      { error: "Admin account already exists" },
      { status: 409 }
    );
  }

  const password_hash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, password_hash },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Add account creation step to onboarding**

Modify `components/onboarding/onboarding-page.tsx`:

- Add a new step (step 2, shift existing steps) called "AdminStep" or "AccountStep"
- Two fields: email + password (with confirmation)
- Calls `POST /api/admin/setup`
- Show after database setup, before Gemini step
- Update total step count

- [ ] **Step 3: Test onboarding flow**

If already onboarded, test the API directly:
```bash
curl -X POST http://localhost:3000/api/admin/setup \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@feedsilo.local","password":"testpassword123"}'
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/setup/ components/onboarding/
git commit -m "feat: admin account creation during onboarding"
```

---

## Chunk 3: Admin API Routes

### Task 8: Admin items list + bulk delete API

**Files:**
- Create: `app/api/admin/items/route.ts`

- [ ] **Step 1: Create paginated items API with search/filter**

Create `app/api/admin/items/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "";
  const skip = (page - 1) * limit;

  const where: any = {};
  if (type) where.source_type = type;
  if (search) {
    where.OR = [
      { body_text: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { author_handle: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.contentItem.findMany({
      where,
      select: {
        id: true,
        external_id: true,
        source_type: true,
        title: true,
        body_text: true,
        author_handle: true,
        author_display_name: true,
        author_avatar_url: true,
        original_url: true,
        posted_at: true,
        created_at: true,
        media_items: { take: 1, select: { original_url: true, stored_path: true, media_type: true } },
      },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    prisma.contentItem.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      body_preview: item.body_text?.substring(0, 150) || "",
      thumbnail: item.media_items[0]?.stored_path || item.media_items[0]?.original_url || null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function DELETE(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { ids } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  // Cascade deletes handle media, tags, categories
  const result = await prisma.contentItem.deleteMany({
    where: { id: { in: ids } },
  });

  return NextResponse.json({ success: true, deleted: result.count });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/items/route.ts
git commit -m "feat: admin items API with pagination, search, filter, bulk delete"
```

### Task 9: Single item edit + delete API

**Files:**
- Create: `app/api/admin/items/[id]/route.ts`

- [ ] **Step 1: Create single item CRUD**

Create `app/api/admin/items/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const { id } = params;
  const updates = await request.json();

  // Whitelist editable fields
  const allowed = [
    "source_type", "author_handle", "author_display_name",
    "title", "body_text", "original_url", "posted_at",
  ];
  const data: any = {};
  for (const key of allowed) {
    if (key in updates) {
      data[key] = updates[key];
    }
  }

  if (data.posted_at) {
    data.posted_at = new Date(data.posted_at);
  }

  const item = await prisma.contentItem.update({
    where: { id },
    data,
  });

  // Regenerate search vector in background
  if (data.body_text || data.title) {
    const rawSql = `
      UPDATE content_items
      SET search_vector = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body_text,'') || ' ' || coalesce(author_handle,''))
      WHERE id = $1::uuid
    `;
    prisma.$queryRawUnsafe(rawSql, id).catch((err: Error) =>
      console.error("Search vector update failed:", err)
    );
  }

  return NextResponse.json({ success: true, item });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  await prisma.contentItem.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/items/\[id\]/route.ts
git commit -m "feat: single item edit and delete API with search vector regeneration"
```

### Task 10: Reprocess API

**Files:**
- Create: `app/api/admin/items/[id]/reprocess/route.ts`

- [ ] **Step 1: Create reprocess endpoint**

Create `app/api/admin/items/[id]/reprocess/route.ts`:

Triggers three operations (all async/non-blocking):
1. Re-classify source_type via content classifier
2. Regenerate tsvector search index
3. Regenerate Gemini embedding

Returns immediately with `{ success: true, message: "Reprocessing started" }`.

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/items/\[id\]/reprocess/route.ts
git commit -m "feat: item reprocess API for reclassification, reindex, re-embed"
```

### Task 11: Manual capture API

**Files:**
- Create: `app/api/admin/items/manual/route.ts`

- [ ] **Step 1: Create manual capture endpoint**

Create `app/api/admin/items/manual/route.ts`:

- Requires auth
- Accepts: `{ source_url?, body_text?, source_type?, author_handle?, title?, posted_at?, media_urls? }`
- Validates at least source_url or body_text present
- Builds a CapturePayload and calls `ingestItem()`
- Returns the ingest result

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/items/manual/route.ts
git commit -m "feat: manual capture API using existing ingestItem pipeline"
```

---

## Chunk 4: Admin UI — Table + Dialogs

### Task 12: Admin page shell

**Files:**
- Create: `app/admin/page.tsx`
- Create: `components/admin/admin-page.tsx`

- [ ] **Step 1: Create admin page server component**

Create `app/admin/page.tsx`:
- Metadata: "Admin — FeedSilo"
- Renders AdminPage client component
- `export const dynamic = "force-dynamic"`

- [ ] **Step 2: Create admin page client component**

Create `components/admin/admin-page.tsx`:
- Header with title + "Add Item" button
- Search input + source_type filter dropdown
- DataTable component (next task)
- BulkActionsBar (appears when items selected)
- Fetches from `/api/admin/items` with search/filter/pagination params
- Uses `useSession` to verify auth (should always be authed due to middleware)

- [ ] **Step 3: Commit**

```bash
git add app/admin/ components/admin/admin-page.tsx
git commit -m "feat: admin page shell with search, filter, and layout"
```

### Task 13: Data table with selection

**Files:**
- Create: `components/admin/data-table.tsx`
- Create: `components/admin/columns.tsx`

- [ ] **Step 1: Create column definitions**

Create `components/admin/columns.tsx`:
- Checkbox column (select/deselect)
- Thumbnail column (first media item, small)
- Title/body preview column (truncated, 150 chars)
- Author column (handle + display name)
- Type column (Badge with color coding: cyan/purple/orange/pink)
- Date column (posted_at, formatted)
- Actions column (dropdown: Edit, Delete, Reprocess, View on X)

- [ ] **Step 2: Create data table component**

Create `components/admin/data-table.tsx`:
- Uses shadcn/ui Table components
- Selection state management (Set of selected IDs)
- Shift-click range selection
- "Select all on page" checkbox
- Server-side pagination controls (prev/next/page indicator)
- Calls parent callbacks: onSelectionChange, onEdit, onDelete, onReprocess
- Dark themed to match existing app

- [ ] **Step 3: Commit**

```bash
git add components/admin/data-table.tsx components/admin/columns.tsx
git commit -m "feat: admin data table with selection, pagination, and action columns"
```

### Task 14: Bulk actions bar

**Files:**
- Create: `components/admin/bulk-actions-bar.tsx`

- [ ] **Step 1: Create bulk actions component**

Create `components/admin/bulk-actions-bar.tsx`:
- Slides in from bottom when items are selected (Framer Motion)
- Shows count ("3 items selected")
- "Delete Selected" button (red, opens AlertDialog)
- "Reprocess Selected" button
- "Clear Selection" button
- Calls parent callbacks for delete/reprocess

- [ ] **Step 2: Commit**

```bash
git add components/admin/bulk-actions-bar.tsx
git commit -m "feat: bulk actions bar with delete and reprocess"
```

### Task 15: Delete confirmation dialog

**Files:**
- Create: `components/admin/delete-confirm-dialog.tsx`

- [ ] **Step 1: Create delete confirmation**

Create `components/admin/delete-confirm-dialog.tsx`:
- Uses shadcn/ui AlertDialog
- Shows count of items to delete
- "This cannot be undone" warning
- Cancel + Confirm buttons
- Calls onConfirm callback with item IDs

- [ ] **Step 2: Commit**

```bash
git add components/admin/delete-confirm-dialog.tsx
git commit -m "feat: delete confirmation dialog"
```

### Task 16: Item edit dialog

**Files:**
- Create: `components/admin/item-edit-dialog.tsx`

- [ ] **Step 1: Create edit dialog**

Create `components/admin/item-edit-dialog.tsx`:
- Uses shadcn/ui Dialog
- Form fields for all editable fields:
  - source_type: Select dropdown
  - author_handle: Input
  - author_display_name: Input
  - title: Input
  - body_text: Textarea (resizable)
  - source_url: Input
  - posted_at: Input type="datetime-local"
- Save + Cancel buttons
- Calls PUT `/api/admin/items/[id]` on save
- Shows loading state during save
- This component is shared between admin table and detail page

- [ ] **Step 2: Commit**

```bash
git add components/admin/item-edit-dialog.tsx
git commit -m "feat: item edit dialog with all editable fields"
```

### Task 17: Manual capture dialog

**Files:**
- Create: `components/admin/manual-capture-dialog.tsx`

- [ ] **Step 1: Create manual capture form**

Create `components/admin/manual-capture-dialog.tsx`:
- Uses shadcn/ui Dialog
- Required: source_url OR body_text (at least one)
- Optional: source_type, author_handle, title, posted_at
- Media URLs as comma-separated text input
- Submit calls POST `/api/admin/items/manual`
- Success: close dialog, refresh table
- Error: show error message

- [ ] **Step 2: Commit**

```bash
git add components/admin/manual-capture-dialog.tsx
git commit -m "feat: manual capture dialog for adding items without extension"
```

---

## Chunk 5: Detail Page Integration + Polish

### Task 18: Admin actions on detail page sidebar

**Files:**
- Create: `components/detail/admin-actions.tsx`
- Modify: `components/detail/detail-sidebar.tsx`

- [ ] **Step 1: Create admin actions component**

Create `components/detail/admin-actions.tsx`:
- Client component using `useSession`
- Only renders when authenticated
- Three buttons: Edit (pencil), Delete (trash), Reprocess (refresh)
- Edit opens ItemEditDialog
- Delete opens DeleteConfirmDialog
- Reprocess calls API and shows toast/status
- Styled as a card matching the sidebar aesthetic

- [ ] **Step 2: Add admin actions to detail sidebar**

Modify `components/detail/detail-sidebar.tsx`:
- Import and render AdminActions component
- Place between AuthorCard and Tags card
- Pass item data as props

- [ ] **Step 3: Commit**

```bash
git add components/detail/admin-actions.tsx components/detail/detail-sidebar.tsx
git commit -m "feat: auth-gated edit/delete/reprocess on detail page sidebar"
```

### Task 19: Wire up admin page with all dialogs

**Files:**
- Modify: `components/admin/admin-page.tsx`

- [ ] **Step 1: Integrate all dialogs and actions**

Update `components/admin/admin-page.tsx` to wire together:
- DataTable → row actions → Edit/Delete/Reprocess
- BulkActionsBar → bulk delete/reprocess
- "Add Item" button → ManualCaptureDialog
- Refresh data after mutations
- Toast notifications for success/error states

- [ ] **Step 2: Commit**

```bash
git add components/admin/admin-page.tsx
git commit -m "feat: wire admin page with all dialogs and actions"
```

### Task 20: Final build check + test

- [ ] **Step 1: Run build**

```bash
npx next build 2>&1 | tail -20
```
Expected: Build succeeds with no errors

- [ ] **Step 2: Manual testing checklist**

1. Visit `/login` — form renders, login works with created credentials
2. Visit `/admin` while not logged in — redirects to `/login`
3. Visit `/admin` while logged in — data table loads with items
4. Search/filter works
5. Single delete works (with confirmation)
6. Bulk select + delete works
7. Edit dialog saves changes
8. Manual capture creates new item
9. Reprocess triggers without error
10. Detail page shows edit/delete/reprocess when logged in
11. Detail page hides admin buttons when not logged in
12. Public pages (feed, detail, search) still work without auth
13. Extension capture still works with Bearer token

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete admin panel with auth, CRUD, bulk operations"
```
