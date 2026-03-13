# Session 3 Chunk 1: Config System + Data Layer Refactoring — Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a config system that reads `feedsilo.config.json` (with env var precedence), refactor the data layer to support both PostgreSQL and SQLite via dual Prisma schemas and a dynamic client factory, implement real SQLite FTS5 search, add first-run detection middleware, and create setup API endpoints.

**Architecture:** Config module with Zod validation reads/writes `feedsilo.config.json` and `.env.local`. Dynamic client factory loads the correct Prisma client (PG or SQLite) based on config. All existing code that imports `prisma` directly is refactored to use `getClient()`. SQLite search uses FTS5 virtual tables. Middleware redirects unconfigured apps to `/onboarding`.

**Tech Stack:** Next.js 14, Prisma v7 (dual schemas), Zod v4, PostgreSQL + pgvector, SQLite + FTS5, Vitest

**Spec:** `docs/superpowers/specs/2026-03-12-session3-onboarding-settings-design.md`

---

## File Structure

### Files to Create

| File | Responsibility |
|------|---------------|
| `lib/config/schema.ts` | Zod validation schema for `feedsilo.config.json` |
| `lib/config/index.ts` | Read/write/resolve config (JSON file + env var precedence) |
| `lib/config/config.test.ts` | Unit tests for config module |
| `prisma/schema-sqlite.prisma` | SQLite Prisma schema (no vector/tsvector columns) |
| `prisma/prisma-sqlite.config.ts` | Prisma CLI config for SQLite schema |
| `lib/db/client.ts` | Dynamic Prisma client factory (`getClient()`) |
| `middleware.ts` | First-run detection, redirect to `/onboarding` |
| `app/api/setup/status/route.ts` | `GET /api/setup/status` |
| `app/api/setup/test-connection/route.ts` | `POST /api/setup/test-connection` |
| `app/api/setup/migrate/route.ts` | `POST /api/setup/migrate` |

### Files to Modify

| File | Change |
|------|--------|
| `lib/db/prisma.ts` | Keep as PG-only singleton, used by PG client path |
| `lib/db/queries.ts` | Import from `lib/db/client.ts` instead of `lib/db/prisma.ts`, guard `fetchRelatedItems` for SQLite |
| `lib/db/search-provider.ts` | Read database type from config module instead of `process.env.DATABASE_TYPE` |
| `lib/db/providers/postgresql.ts` | Import from `lib/db/client.ts` instead of `lib/db/prisma.ts` |
| `lib/db/providers/sqlite.ts` | Full FTS5 implementation replacing stub |
| `lib/auth/capture-secret.ts` | Fall back to config `extension.pairingToken` if `CAPTURE_SECRET` env var is not set |
| `lib/ingest/index.ts` | Import from `lib/db/client.ts` instead of `lib/db/prisma.ts` |
| `package.json` | Add `canvas-confetti`, add `prisma:generate` dual-schema script, add `postinstall` |
| `.gitignore` | Add `feedsilo.config.json`, `lib/generated/prisma-sqlite` |
| `.env.example` | Add note about `feedsilo.config.json` alternative |

---

## Task 1: Config Module — Schema & Core Functions

**Files:**
- Create: `lib/config/schema.ts`
- Create: `lib/config/index.ts`
- Create: `lib/config/config.test.ts`

- [ ] **Step 1: Write config schema tests**

Create `lib/config/config.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configSchema, type FeedsiloConfig } from './schema';

describe('configSchema', () => {
  it('validates a complete postgresql config', () => {
    const config = {
      database: { type: 'postgresql', url: 'postgresql://user:pass@localhost:5432/db' },
      embeddings: { provider: 'gemini', apiKey: 'test-key' },
      extension: { pairingToken: 'abc-123' },
      search: { keywordWeight: 0.4, semanticWeight: 0.6 },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('validates a minimal sqlite config', () => {
    const config = {
      database: { type: 'sqlite', url: 'file:./feedsilo.db' },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('rejects invalid database type', () => {
    const config = {
      database: { type: 'mysql', url: 'mysql://localhost' },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('rejects missing database url', () => {
    const config = {
      database: { type: 'postgresql' },
    };
    const result = configSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('applies defaults for optional fields', () => {
    const config = {
      database: { type: 'sqlite', url: 'file:./feedsilo.db' },
    };
    const result = configSchema.parse(config);
    expect(result.search.keywordWeight).toBe(0.4);
    expect(result.search.semanticWeight).toBe(0.6);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/config/config.test.ts`
Expected: FAIL — modules don't exist yet

- [ ] **Step 3: Create config schema**

Create `lib/config/schema.ts`:

```typescript
import { z } from "zod";

export const databaseConfigSchema = z.object({
  type: z.enum(["postgresql", "supabase", "sqlite"]),
  url: z.string().min(1),
});

export const embeddingsConfigSchema = z.object({
  provider: z.enum(["gemini"]).default("gemini"),
  apiKey: z.string().optional(),
});

export const extensionConfigSchema = z.object({
  pairingToken: z.string().optional(),
});

export const searchConfigSchema = z.object({
  keywordWeight: z.number().min(0).max(1).default(0.4),
  semanticWeight: z.number().min(0).max(1).default(0.6),
});

export const configSchema = z.object({
  database: databaseConfigSchema,
  embeddings: embeddingsConfigSchema.default({}),
  extension: extensionConfigSchema.default({}),
  search: searchConfigSchema.default({}),
});

export type FeedsiloConfig = z.infer<typeof configSchema>;
export type DatabaseType = FeedsiloConfig["database"]["type"];
```

- [ ] **Step 4: Run schema tests to verify they pass**

Run: `npx vitest run lib/config/config.test.ts`
Expected: PASS — all 5 tests

- [ ] **Step 5: Write config reader/writer tests**

Append to `lib/config/config.test.ts`:

```typescript
import { readConfig, writeConfig, resolveConfig, isConfigured } from './index';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('readConfig', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedsilo-test-'));
    configPath = path.join(tmpDir, 'feedsilo.config.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when config file does not exist', () => {
    const result = readConfig(configPath);
    expect(result).toBeNull();
  });

  it('returns null when config file is malformed JSON', () => {
    fs.writeFileSync(configPath, '{ broken json');
    const result = readConfig(configPath);
    expect(result).toBeNull();
  });

  it('returns null when config file fails Zod validation', () => {
    fs.writeFileSync(configPath, JSON.stringify({ database: { type: 'mysql' } }));
    const result = readConfig(configPath);
    expect(result).toBeNull();
  });

  it('reads and validates a correct config file', () => {
    const config = { database: { type: 'postgresql', url: 'postgresql://localhost/db' } };
    fs.writeFileSync(configPath, JSON.stringify(config));
    const result = readConfig(configPath);
    expect(result).not.toBeNull();
    expect(result!.database.type).toBe('postgresql');
  });
});

describe('writeConfig', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedsilo-test-'));
    configPath = path.join(tmpDir, 'feedsilo.config.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes config and .env.local files', () => {
    const config = {
      database: { type: 'postgresql' as const, url: 'postgresql://localhost/db' },
      embeddings: { provider: 'gemini' as const, apiKey: 'key123' },
      extension: { pairingToken: 'token456' },
      search: { keywordWeight: 0.4, semanticWeight: 0.6 },
    };
    const envPath = path.join(tmpDir, '.env.local');
    writeConfig(config, configPath, envPath);

    // Verify config file
    const written = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(written.database.type).toBe('postgresql');

    // Verify .env.local
    const envContent = fs.readFileSync(envPath, 'utf-8');
    expect(envContent).toContain('DATABASE_URL=postgresql://localhost/db');
    expect(envContent).toContain('DATABASE_TYPE=postgresql');
    expect(envContent).toContain('GEMINI_API_KEY=key123');
    expect(envContent).toContain('CAPTURE_SECRET=token456');
  });
});

describe('resolveConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('env vars take precedence over file config', () => {
    process.env.DATABASE_URL = 'postgresql://env-override/db';
    process.env.DATABASE_TYPE = 'postgresql';
    const fileConfig = {
      database: { type: 'sqlite' as const, url: 'file:./test.db' },
      embeddings: { provider: 'gemini' as const },
      extension: {},
      search: { keywordWeight: 0.4, semanticWeight: 0.6 },
    };
    const resolved = resolveConfig(fileConfig);
    expect(resolved.database.url).toBe('postgresql://env-override/db');
    expect(resolved.database.type).toBe('postgresql');
  });

  it('builds config from env vars when file config is null', () => {
    process.env.DATABASE_URL = 'postgresql://env-only/db';
    process.env.DATABASE_TYPE = 'postgresql';
    const resolved = resolveConfig(null);
    expect(resolved).not.toBeNull();
    expect(resolved!.database.url).toBe('postgresql://env-only/db');
    expect(resolved!.database.type).toBe('postgresql');
  });

  it('returns null when no file config and no env vars', () => {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_TYPE;
    const resolved = resolveConfig(null);
    expect(resolved).toBeNull();
  });

  it('falls back to file config when env vars are not set', () => {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_TYPE;
    const fileConfig = {
      database: { type: 'sqlite' as const, url: 'file:./test.db' },
      embeddings: { provider: 'gemini' as const },
      extension: {},
      search: { keywordWeight: 0.4, semanticWeight: 0.6 },
    };
    const resolved = resolveConfig(fileConfig);
    expect(resolved.database.type).toBe('sqlite');
    expect(resolved.database.url).toBe('file:./test.db');
  });
});

describe('isConfigured', () => {
  it('returns false when config is null', () => {
    expect(isConfigured(null)).toBe(false);
  });

  it('returns true when config has database type and url', () => {
    const config = {
      database: { type: 'sqlite' as const, url: 'file:./test.db' },
      embeddings: { provider: 'gemini' as const },
      extension: {},
      search: { keywordWeight: 0.4, semanticWeight: 0.6 },
    };
    expect(isConfigured(config)).toBe(true);
  });
});
```

- [ ] **Step 6: Create config reader/writer**

Create `lib/config/index.ts`:

```typescript
import fs from "fs";
import path from "path";
import { configSchema, type FeedsiloConfig, type DatabaseType } from "./schema";

const PROJECT_ROOT = process.cwd();
const DEFAULT_CONFIG_PATH = path.join(PROJECT_ROOT, "feedsilo.config.json");
const DEFAULT_ENV_PATH = path.join(PROJECT_ROOT, ".env.local");

/**
 * Read and validate feedsilo.config.json.
 * Returns null if file doesn't exist, is malformed, or fails validation.
 */
export function readConfig(
  configPath: string = DEFAULT_CONFIG_PATH
): FeedsiloConfig | null {
  try {
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    const result = configSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Write config to feedsilo.config.json and .env.local.
 */
export function writeConfig(
  config: FeedsiloConfig,
  configPath: string = DEFAULT_CONFIG_PATH,
  envPath: string = DEFAULT_ENV_PATH
): void {
  // Write config JSON
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

  // Write .env.local for Prisma CLI compatibility
  const lines: string[] = [
    "# Generated by FeedSilo onboarding — do not edit manually",
    `DATABASE_URL=${config.database.url}`,
    `DATABASE_TYPE=${config.database.type}`,
  ];
  if (config.embeddings?.apiKey) {
    lines.push(`GEMINI_API_KEY=${config.embeddings.apiKey}`);
  }
  if (config.extension?.pairingToken) {
    lines.push(`CAPTURE_SECRET=${config.extension.pairingToken}`);
  }
  if (config.search) {
    lines.push(`SEARCH_KEYWORD_WEIGHT=${config.search.keywordWeight}`);
    lines.push(`SEARCH_VECTOR_WEIGHT=${config.search.semanticWeight}`);
  }
  fs.writeFileSync(envPath, lines.join("\n") + "\n", "utf-8");
}

/**
 * Resolve config with env var precedence.
 * Env vars override file config values when set.
 */
export function resolveConfig(
  fileConfig: FeedsiloConfig | null
): FeedsiloConfig | null {
  if (!fileConfig) {
    // Check if env vars alone provide enough config
    const dbUrl = process.env.DATABASE_URL;
    const dbType = process.env.DATABASE_TYPE as DatabaseType | undefined;
    if (dbUrl && dbType) {
      return configSchema.parse({
        database: { type: dbType, url: dbUrl },
        embeddings: {
          provider: "gemini",
          apiKey: process.env.GEMINI_API_KEY || undefined,
        },
        extension: {
          pairingToken: process.env.CAPTURE_SECRET || undefined,
        },
        search: {
          keywordWeight: process.env.SEARCH_KEYWORD_WEIGHT
            ? parseFloat(process.env.SEARCH_KEYWORD_WEIGHT)
            : 0.4,
          semanticWeight: process.env.SEARCH_VECTOR_WEIGHT
            ? parseFloat(process.env.SEARCH_VECTOR_WEIGHT)
            : 0.6,
        },
      });
    }
    return null;
  }

  return {
    ...fileConfig,
    database: {
      type: (process.env.DATABASE_TYPE as DatabaseType) || fileConfig.database.type,
      url: process.env.DATABASE_URL || fileConfig.database.url,
    },
    embeddings: {
      ...fileConfig.embeddings,
      apiKey: process.env.GEMINI_API_KEY || fileConfig.embeddings?.apiKey,
    },
    extension: {
      ...fileConfig.extension,
      pairingToken:
        process.env.CAPTURE_SECRET || fileConfig.extension?.pairingToken,
    },
    search: {
      keywordWeight: process.env.SEARCH_KEYWORD_WEIGHT
        ? parseFloat(process.env.SEARCH_KEYWORD_WEIGHT)
        : fileConfig.search.keywordWeight,
      semanticWeight: process.env.SEARCH_VECTOR_WEIGHT
        ? parseFloat(process.env.SEARCH_VECTOR_WEIGHT)
        : fileConfig.search.semanticWeight,
    },
  };
}

/**
 * Check if the app has a valid database configuration.
 */
export function isConfigured(config: FeedsiloConfig | null): boolean {
  return config !== null && !!config.database.type && !!config.database.url;
}

// Cached resolved config for the current process
let _resolvedConfig: FeedsiloConfig | null | undefined;

/**
 * Get the current resolved config (file + env vars).
 * Cached per-process. Call invalidateConfigCache() after writes.
 */
export function getConfig(): FeedsiloConfig | null {
  if (_resolvedConfig !== undefined) return _resolvedConfig;
  const fileConfig = readConfig();
  _resolvedConfig = resolveConfig(fileConfig);
  return _resolvedConfig;
}

/**
 * Invalidate the cached config. Call after writeConfig().
 */
export function invalidateConfigCache(): void {
  _resolvedConfig = undefined;
}

export { configSchema, type FeedsiloConfig, type DatabaseType } from "./schema";
```

- [ ] **Step 7: Run all config tests**

Run: `npx vitest run lib/config/config.test.ts`
Expected: PASS — all tests

- [ ] **Step 8: Commit**

```bash
git add lib/config/schema.ts lib/config/index.ts lib/config/config.test.ts
git commit -m "feat: add config module with Zod validation, read/write, env var precedence"
```

---

## Task 2: Package Updates & Build Scripts

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `.env.example`

- [ ] **Step 1: Install new dependencies**

Run: `npm install canvas-confetti better-sqlite3 && npm install -D @types/canvas-confetti @types/better-sqlite3`

- `canvas-confetti` — confetti animation for onboarding Chunk 2
- `better-sqlite3` — SQLite driver required by Prisma's SQLite provider

- [ ] **Step 2: Update package.json scripts for dual Prisma generation**

Add to `package.json` scripts:
```json
"prisma:generate": "prisma generate --schema=prisma/schema.prisma && prisma generate --schema=prisma/schema-sqlite.prisma",
"postinstall": "npm run prisma:generate"
```

- [ ] **Step 3: Update .gitignore**

Add these entries:
```
# FeedSilo config (written by onboarding)
feedsilo.config.json

# SQLite generated Prisma client
/lib/generated/prisma-sqlite

# SQLite database files
*.db
*.db-journal
*.db-wal
```

- [ ] **Step 4: Update .env.example**

Add a comment block at the top:
```
# FeedSilo Configuration
# ─────────────────────────────────────────────────
# Option 1: Run `npm run dev` and use the onboarding wizard (recommended)
# Option 2: Copy this file to .env.local and fill in values manually
# Environment variables override feedsilo.config.json values
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example
git commit -m "chore: add canvas-confetti, dual prisma generate script, update gitignore"
```

---

## Task 3: SQLite Prisma Schema

**Files:**
- Create: `prisma/schema-sqlite.prisma`
- Create: `prisma/prisma-sqlite.config.ts`

- [ ] **Step 1: Create SQLite Prisma schema**

Create `prisma/schema-sqlite.prisma` by adapting the PostgreSQL schema:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../lib/generated/prisma-sqlite"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model ContentItem {
  id                  String    @id @default(uuid())
  source_type         String
  external_id         String?
  author_handle       String?
  author_display_name String?
  author_avatar_url   String?
  title               String
  body_text           String
  body_html           String?
  original_url        String?
  posted_at           DateTime?
  likes               Int?
  retweets            Int?
  replies             Int?
  views               Int?
  has_prompt          Boolean   @default(false)
  prompt_text         String?
  prompt_type         String?
  language            String?
  ai_summary          String?
  raw_markdown        String
  source_file_path    String    @unique
  content_hash        String
  processing_status   String    @default("parsed")
  processing_error    String?
  created_at          DateTime  @default(now())
  updated_at          DateTime  @default(now()) @updatedAt

  media_items MediaItem[]
  categories  ContentCategory[]
  tags        ContentTag[]

  @@index([external_id])
  @@index([content_hash])
  @@map("content_items")
}

model Category {
  id          String  @id @default(uuid())
  name        String
  slug        String  @unique
  description String?
  parent_id   String?
  parent      Category?  @relation("CategoryHierarchy", fields: [parent_id], references: [id])
  children    Category[] @relation("CategoryHierarchy")

  content_items ContentCategory[]

  @@map("categories")
}

model Tag {
  id   String @id @default(uuid())
  name String @unique
  slug String @unique

  content_items ContentTag[]

  @@map("tags")
}

model MediaItem {
  id                  String  @id @default(uuid())
  content_item_id     String
  content_item        ContentItem @relation(fields: [content_item_id], references: [id], onDelete: Cascade)
  media_type          String
  original_url        String
  stored_path         String?
  alt_text            String?
  ai_description      String?
  position_in_content Int?
  file_size_bytes     Int?
  width               Int?
  height              Int?

  @@map("media")
}

model ContentCategory {
  content_item_id String
  category_id     String
  content_item    ContentItem @relation(fields: [content_item_id], references: [id], onDelete: Cascade)
  category        Category    @relation(fields: [category_id], references: [id], onDelete: Cascade)

  @@id([content_item_id, category_id])
  @@map("content_categories")
}

model ContentTag {
  content_item_id String
  tag_id          String
  content_item    ContentItem @relation(fields: [content_item_id], references: [id], onDelete: Cascade)
  tag             Tag         @relation(fields: [tag_id], references: [id], onDelete: Cascade)

  @@id([content_item_id, tag_id])
  @@map("content_tags")
}
```

Key differences from PG schema:
- No `Unsupported("vector(768)")` column — embeddings not supported on SQLite
- No `Unsupported("tsvector")` column — FTS5 used instead (separate virtual table)
- No pgvector extension declaration
- Enums replaced with String (SQLite doesn't support enums)
- `@default(uuid())` instead of `@default(dbgenerated("gen_random_uuid()"))`
- No `@db.Uuid`, `@db.Text`, `@db.Timestamptz(6)` annotations (PG-specific)
- Model named `MediaItem` to avoid potential SQLite reserved word conflict with `Media`

- [ ] **Step 2: Create SQLite Prisma config**

Create `prisma/prisma-sqlite.config.ts`:

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema-sqlite.prisma",
  migrations: {
    path: "prisma/migrations-sqlite",
  },
  datasource: {
    url: process.env["DATABASE_URL"] || "file:./feedsilo.db",
  },
});
```

- [ ] **Step 3: Verify dual generation works**

Run: `npx prisma generate --schema=prisma/schema.prisma && npx prisma generate --schema=prisma/schema-sqlite.prisma`
Expected: Both generate successfully into their output directories

- [ ] **Step 4: Commit**

```bash
git add prisma/schema-sqlite.prisma prisma/prisma-sqlite.config.ts
git commit -m "feat: add SQLite Prisma schema for dual-backend support"
```

---

## Task 4: Dynamic Client Factory

**Files:**
- Create: `lib/db/client.ts`
- Modify: `lib/db/prisma.ts`

- [ ] **Step 1: Create dynamic client factory**

Create `lib/db/client.ts`:

```typescript
import { getConfig, type DatabaseType } from "@/lib/config";

type PrismaClientAny = any; // Both PG and SQLite clients satisfy this

const globalForClient = globalThis as unknown as {
  feedsiloClient: PrismaClientAny | undefined;
  feedsiloDbType: DatabaseType | undefined;
};

/**
 * Get the Prisma client for the configured database backend.
 * Caches client in globalThis (survives Next.js HMR in dev).
 * Throws if no database is configured.
 */
export async function getClient(): Promise<PrismaClientAny> {
  const config = getConfig();
  if (!config) {
    throw new Error(
      "No database configured. Complete onboarding at /onboarding"
    );
  }

  const dbType = config.database.type;

  // Return cached client if same database type
  if (globalForClient.feedsiloClient && globalForClient.feedsiloDbType === dbType) {
    return globalForClient.feedsiloClient;
  }

  let client: PrismaClientAny;

  if (dbType === "sqlite") {
    const { PrismaClient } = await import(
      "@/lib/generated/prisma-sqlite/client"
    );
    client = new PrismaClient({
      datasourceUrl: config.database.url,
      log: process.env.NODE_ENV === "development" ? ["query"] : [],
    });
  } else {
    // postgresql or supabase — both use PG client
    const { PrismaClient } = await import("@/lib/generated/prisma/client");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const adapter = new PrismaPg({ connectionString: config.database.url });
    client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["query"] : [],
    });
  }

  globalForClient.feedsiloClient = client;
  globalForClient.feedsiloDbType = dbType;

  return client;
}

/**
 * Get the configured database type without initializing a client.
 */
export function getDatabaseType(): DatabaseType | null {
  const config = getConfig();
  return config?.database.type ?? null;
}

/**
 * Disconnect and clear the cached client.
 * Call when switching databases.
 */
export async function disconnectClient(): Promise<void> {
  if (globalForClient.feedsiloClient) {
    await globalForClient.feedsiloClient.$disconnect();
    globalForClient.feedsiloClient = undefined;
    globalForClient.feedsiloDbType = undefined;
  }
}
```

- [ ] **Step 2: Keep lib/db/prisma.ts as legacy fallback**

Update `lib/db/prisma.ts` to add a deprecation comment but keep it working for the existing code during migration. We'll update consumers in the next task.

Add a comment at the top of `lib/db/prisma.ts`:
```typescript
/**
 * @deprecated Use getClient() from '@/lib/db/client' instead.
 * This file is kept temporarily for backward compatibility during migration.
 * It will be removed once all consumers use getClient().
 */
```

- [ ] **Step 3: Commit**

```bash
git add lib/db/client.ts lib/db/prisma.ts
git commit -m "feat: add dynamic Prisma client factory for multi-backend support"
```

---

## Task 5: Migrate Consumers to Dynamic Client

**Files:**
- Modify: `lib/db/queries.ts`
- Modify: `lib/db/providers/postgresql.ts`
- Modify: `lib/ingest/index.ts`

- [ ] **Step 1: Update queries.ts**

Replace `import { prisma } from "./prisma"` with `import { getClient, getDatabaseType } from "./client"`.

Every function that currently uses `prisma.xyz` needs to become:
```typescript
const prisma = await getClient();
prisma.contentItem.findMany(...)
```

Guard `fetchRelatedItems` for SQLite:

```typescript
export async function fetchRelatedItems(itemId: string, limit: number = 6) {
  const dbType = getDatabaseType();
  if (dbType === "sqlite") {
    // pgvector not available on SQLite — return empty
    return [];
  }

  const prisma = await getClient();
  const results = await prisma.$queryRawUnsafe(`...pgvector query...`, itemId, limit);
  return results as Array<{...}>;
}
```

All other functions (`fetchItems`, `fetchStats`, `fetchItemById`, `fetchThreadChain`) get `const prisma = await getClient();` at the top.

- [ ] **Step 2: Update postgresql.ts**

Replace `import { prisma } from "@/lib/db/prisma"` with `import { getClient } from "@/lib/db/client"`.

In `PostgresSearchProvider`, each method that currently uses `prisma.$queryRawUnsafe(...)` needs:
```typescript
const prisma = await getClient();
```
at the top of the method body.

- [ ] **Step 3: Update ingest/index.ts**

Replace `import { prisma } from "@/lib/db/prisma"` with `import { getClient } from "@/lib/db/client"`.

In `ingestItem()`:
```typescript
const prisma = await getClient();
```
at the top, then use `prisma.contentItem.findFirst(...)`, `prisma.contentItem.create(...)`, etc.

Same for `indexItemInBackground()`.

- [ ] **Step 4: Verify build compiles**

Run: `npx next build 2>&1 | head -5`
Expected: `✓ Compiled successfully` (existing ESLint warnings are acceptable)

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries.ts lib/db/providers/postgresql.ts lib/ingest/index.ts
git commit -m "refactor: migrate all data layer consumers to dynamic client factory"
```

---

## Task 6: Update Search Provider Factory

**Files:**
- Modify: `lib/db/search-provider.ts`

- [ ] **Step 1: Update getSearchProvider to read from config**

Replace the `process.env.DATABASE_TYPE` read with config module:

```typescript
import type { SearchFilters, SearchOptions, ScoredResult } from "./types";
import { getConfig } from "@/lib/config";

export interface SearchProvider {
  // ... (unchanged)
}

let _cachedProvider: SearchProvider | null = null;
let _cachedDbType: string | null = null;

export async function getSearchProvider(): Promise<SearchProvider> {
  const config = getConfig();
  const dbType = config?.database.type || process.env.DATABASE_TYPE || "postgresql";

  // Invalidate cache if database type changed
  if (_cachedProvider && _cachedDbType === dbType) return _cachedProvider;

  switch (dbType) {
    case "postgresql": {
      const { PostgresSearchProvider } = await import("./providers/postgresql");
      _cachedProvider = new PostgresSearchProvider();
      break;
    }
    case "supabase": {
      const { SupabaseSearchProvider } = await import("./providers/supabase");
      _cachedProvider = new SupabaseSearchProvider();
      break;
    }
    case "sqlite": {
      const { SqliteSearchProvider } = await import("./providers/sqlite");
      _cachedProvider = new SqliteSearchProvider();
      break;
    }
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }

  _cachedDbType = dbType;
  return _cachedProvider;
}

/**
 * Invalidate the cached provider. Call when switching databases.
 */
export function invalidateSearchProvider(): void {
  _cachedProvider = null;
  _cachedDbType = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/db/search-provider.ts
git commit -m "refactor: search provider reads database type from config module"
```

---

## Task 7: SQLite FTS5 Search Provider

**Files:**
- Modify: `lib/db/providers/sqlite.ts`

- [ ] **Step 1: Implement FTS5 search provider**

Replace the entire stub with a real implementation:

```typescript
import type { SearchProvider } from "@/lib/db/search-provider";
import type { SearchFilters, SearchOptions, ScoredResult } from "@/lib/db/types";
import { getClient } from "@/lib/db/client";

/**
 * SQLite search provider using FTS5 for keyword search.
 * Semantic search (vector similarity) is not supported on SQLite.
 */
export class SqliteSearchProvider implements SearchProvider {
  /**
   * Ensure the FTS5 virtual table exists.
   * Safe to call multiple times — uses IF NOT EXISTS.
   */
  async ensureFts5Table(): Promise<void> {
    const prisma = await getClient();
    await prisma.$executeRawUnsafe(`
      CREATE VIRTUAL TABLE IF NOT EXISTS content_items_fts USING fts5(
        title,
        body_text,
        ai_summary,
        author_handle,
        content=content_items,
        content_rowid=rowid
      )
    `);
    // Triggers to keep FTS5 in sync with content_items on delete/update
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER IF NOT EXISTS content_items_fts_delete
      AFTER DELETE ON content_items BEGIN
        INSERT INTO content_items_fts(content_items_fts, rowid, title, body_text, ai_summary, author_handle)
        VALUES('delete', old.rowid, old.title, old.body_text, old.ai_summary, old.author_handle);
      END
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER IF NOT EXISTS content_items_fts_update
      AFTER UPDATE ON content_items BEGIN
        INSERT INTO content_items_fts(content_items_fts, rowid, title, body_text, ai_summary, author_handle)
        VALUES('delete', old.rowid, old.title, old.body_text, old.ai_summary, old.author_handle);
        INSERT INTO content_items_fts(rowid, title, body_text, ai_summary, author_handle)
        VALUES(new.rowid, new.title, new.body_text, new.ai_summary, new.author_handle);
      END
    `);
  }

  async keywordSearch(
    query: string,
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]> {
    if (!query.trim()) return [];

    const prisma = await getClient();
    const offset = (opts.page - 1) * opts.perPage;

    // Build filter clauses
    let filterSql = "";
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.type) {
      filterSql += ` AND ci.source_type = ?`;
      params.push(filters.type);
    }
    if (filters.author) {
      filterSql += ` AND (ci.author_handle LIKE ? OR ci.author_display_name LIKE ?)`;
      params.push(`%${filters.author}%`, `%${filters.author}%`);
    }

    // FTS5 query with bm25 ranking
    const ftsQuery = query.replace(/['"]/g, ""); // sanitize for FTS5
    const results = await prisma.$queryRawUnsafe(`
      SELECT ci.id, ci.source_type, ci.title,
             substr(ci.body_text, 1, 200) as body_excerpt,
             ci.author_handle, ci.author_display_name, ci.author_avatar_url,
             ci.original_url, ci.posted_at,
             m.id as media_id, m.media_type, m.original_url as media_url,
             bm25(content_items_fts) as relevance_score
      FROM content_items_fts
      JOIN content_items ci ON content_items_fts.rowid = ci.rowid
      LEFT JOIN media m ON m.content_item_id = ci.id
      WHERE content_items_fts MATCH ?
        ${filterSql}
      ORDER BY bm25(content_items_fts)
      LIMIT ? OFFSET ?
    `, ftsQuery, ...params, opts.perPage, offset) as any[];

    return results.map(this.mapRow);
  }

  async semanticSearch(
    _embedding: number[],
    _filters: SearchFilters,
    _opts: SearchOptions
  ): Promise<ScoredResult[]> {
    // Vector search not supported on SQLite
    return [];
  }

  async authorSearch(
    query: string,
    filters: SearchFilters,
    opts: SearchOptions
  ): Promise<ScoredResult[]> {
    const prisma = await getClient();
    const offset = (opts.page - 1) * opts.perPage;
    const searchTerm = query.startsWith("@") ? query.slice(1) : query;

    const results = await prisma.$queryRawUnsafe(`
      SELECT ci.id, ci.source_type, ci.title,
             substr(ci.body_text, 1, 200) as body_excerpt,
             ci.author_handle, ci.author_display_name, ci.author_avatar_url,
             ci.original_url, ci.posted_at,
             m.id as media_id, m.media_type, m.original_url as media_url,
             1.0 as relevance_score
      FROM content_items ci
      LEFT JOIN media m ON m.content_item_id = ci.id
      WHERE ci.author_handle LIKE ? OR ci.author_display_name LIKE ?
      ORDER BY ci.posted_at DESC
      LIMIT ? OFFSET ?
    `, `%${searchTerm}%`, `%${searchTerm}%`, opts.perPage, offset) as any[];

    return results.map(this.mapRow);
  }

  async countResults(query: string, filters: SearchFilters): Promise<number> {
    if (!query.trim()) return 0;
    const prisma = await getClient();
    const ftsQuery = query.replace(/['"]/g, "");

    let filterSql = "";
    const params: unknown[] = [];
    if (filters.type) {
      filterSql += ` AND ci.source_type = ?`;
      params.push(filters.type);
    }

    const result = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count
      FROM content_items_fts
      JOIN content_items ci ON content_items_fts.rowid = ci.rowid
      WHERE content_items_fts MATCH ?
        ${filterSql}
    `, ftsQuery, ...params) as any[];

    return Number(result[0]?.count ?? 0);
  }

  async writeEmbedding(
    _itemId: string,
    _embedding: number[]
  ): Promise<void> {
    // No-op: SQLite does not support vector columns
  }

  async updateSearchVector(
    itemId: string,
    content: { title: string; body: string; summary?: string; author?: string }
  ): Promise<void> {
    const prisma = await getClient();

    // Get the rowid for this content item
    const rows = await prisma.$queryRawUnsafe(
      `SELECT rowid FROM content_items WHERE id = ?`,
      itemId
    ) as any[];

    if (rows.length === 0) return;
    const rowid = rows[0].rowid;

    // Upsert into FTS5 table using INSERT OR REPLACE pattern
    // First delete existing entry, then insert
    await prisma.$executeRawUnsafe(
      `DELETE FROM content_items_fts WHERE rowid = ?`,
      rowid
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO content_items_fts(rowid, title, body_text, ai_summary, author_handle)
       VALUES (?, ?, ?, ?, ?)`,
      rowid,
      content.title || "",
      content.body || "",
      content.summary || "",
      content.author || ""
    );
  }

  private mapRow(row: any): ScoredResult {
    return {
      id: row.id,
      source_type: row.source_type,
      title: row.title || "",
      body_excerpt: row.body_excerpt || "",
      author_handle: row.author_handle,
      author_display_name: row.author_display_name,
      author_avatar_url: row.author_avatar_url,
      source_url: row.original_url,
      posted_at: row.posted_at ? String(row.posted_at) : null,
      media_preview:
        row.media_id && row.media_type && row.media_url
          ? { id: row.media_id, type: row.media_type, url: row.media_url }
          : null,
      relevance_score: Math.abs(Number(row.relevance_score) || 0),
    };
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx next build 2>&1 | head -5`
Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add lib/db/providers/sqlite.ts
git commit -m "feat: implement real SQLite FTS5 search provider"
```

---

## Task 8: Auth Token Migration

**Files:**
- Modify: `lib/auth/capture-secret.ts`

- [ ] **Step 1: Update capture-secret to fall back to config**

```typescript
import { NextRequest } from "next/server";
import { getConfig } from "@/lib/config";

export function validateCaptureSecret(
  request: NextRequest
): { valid: boolean; error?: string } {
  // Priority: CAPTURE_SECRET env var > config pairingToken
  const captureSecret =
    process.env.CAPTURE_SECRET || getConfig()?.extension?.pairingToken;

  if (!captureSecret) {
    return { valid: false, error: "CAPTURE_SECRET not configured on server" };
  }

  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return { valid: false, error: "Missing Authorization header" };
  }

  const token = auth.slice(7);
  if (token !== captureSecret) {
    return { valid: false, error: "Invalid capture secret" };
  }

  return { valid: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth/capture-secret.ts
git commit -m "feat: auth falls back to config pairingToken when CAPTURE_SECRET env not set"
```

---

## Task 9: First-Run Middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create middleware**

Create `middleware.ts` in project root.

Uses a cookie-based approach because Next.js Edge Middleware cannot access `fs`. The cookie `feedsilo-configured` is set by `POST /api/setup/migrate` on successful setup.

```typescript
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/onboarding",
  "/api/setup",
  "/_next",
  "/favicon.ico",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip check for public/exempt paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Fast path: env vars set (Docker/production deployments)
  if (process.env.DATABASE_URL && process.env.DATABASE_TYPE) {
    return NextResponse.next();
  }

  // Check for onboarding-complete cookie (set by /api/setup/migrate)
  const configured = request.cookies.get("feedsilo-configured");
  if (configured?.value === "true") {
    return NextResponse.next();
  }

  // Not configured — redirect to onboarding
  return NextResponse.redirect(new URL("/onboarding", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add first-run detection middleware, redirects to /onboarding"
```

---

## Task 10: API — Setup Status

**Files:**
- Create: `app/api/setup/status/route.ts`

- [ ] **Step 1: Create status endpoint**

```typescript
import { NextResponse } from "next/server";
import { getConfig, isConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getConfig();
  return NextResponse.json({
    configured: isConfigured(config),
    databaseType: config?.database.type ?? null,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/setup/status/route.ts
git commit -m "feat: add GET /api/setup/status endpoint"
```

---

## Task 11: API — Test Connection

**Files:**
- Create: `app/api/setup/test-connection/route.ts`

- [ ] **Step 1: Create test-connection endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  type: z.enum(["postgresql", "supabase", "sqlite"]),
  url: z.string().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  supabaseUrl: z.string().optional(),
  supabaseAnonKey: z.string().optional(),
  supabaseServiceKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { connected: false, pgvector: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { type } = parsed.data;

    if (type === "sqlite") {
      return testSqliteConnection(parsed.data);
    } else {
      return testPgConnection(parsed.data);
    }
  } catch (error: any) {
    return NextResponse.json(
      { connected: false, pgvector: false, error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}

async function testSqliteConnection(data: z.infer<typeof requestSchema>) {
  const fs = await import("fs");
  const path = await import("path");

  const dbUrl = data.url || "file:./feedsilo.db";
  const filePath = dbUrl.replace(/^file:/, "");
  const dir = path.dirname(path.resolve(filePath));

  try {
    fs.accessSync(dir, fs.constants.W_OK);
    return NextResponse.json({ connected: true, pgvector: false });
  } catch {
    return NextResponse.json({
      connected: false,
      pgvector: false,
      error: `Directory not writable: ${dir}`,
    });
  }
}

async function testPgConnection(data: z.infer<typeof requestSchema>) {
  let connectionString = data.url;

  // Build connection string from individual fields if not provided
  if (!connectionString && data.host) {
    const user = data.username || "postgres";
    const pass = data.password ? `:${data.password}` : "";
    const port = data.port || 5432;
    const db = data.database || "feedsilo";
    connectionString = `postgresql://${user}${pass}@${data.host}:${port}/${db}`;
  }

  // For Supabase, construct from project URL
  if (!connectionString && data.supabaseUrl) {
    // Supabase connection string format: postgresql://postgres.[project-ref]:[password]@[host]:5432/postgres
    // The user needs to provide the full connection string for now
    return NextResponse.json({
      connected: false,
      pgvector: false,
      error: "Please provide a PostgreSQL connection string for Supabase",
    });
  }

  if (!connectionString) {
    return NextResponse.json({
      connected: false,
      pgvector: false,
      error: "No connection string provided",
    });
  }

  // Test connection using pg directly
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 10000 });

  try {
    const client = await pool.connect();

    // Test basic query
    await client.query("SELECT 1");

    // Check for pgvector extension
    let pgvector = false;
    try {
      const extResult = await client.query(
        "SELECT 1 FROM pg_extension WHERE extname = 'vector'"
      );
      pgvector = extResult.rows.length > 0;
    } catch {
      // pgvector check failed — not available
    }

    client.release();
    await pool.end();

    return NextResponse.json({ connected: true, pgvector });
  } catch (error: any) {
    await pool.end().catch(() => {});
    return NextResponse.json({
      connected: false,
      pgvector: false,
      error: error.message || "Connection failed",
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/setup/test-connection/route.ts
git commit -m "feat: add POST /api/setup/test-connection with pgvector detection"
```

---

## Task 12: API — Migrate

**Files:**
- Create: `app/api/setup/migrate/route.ts`

- [ ] **Step 1: Create migrate endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeConfig, invalidateConfigCache, type FeedsiloConfig } from "@/lib/config";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const requestSchema = z.object({
  database: z.object({
    type: z.enum(["postgresql", "supabase", "sqlite"]),
    url: z.string().min(1),
  }),
  embeddings: z.object({
    provider: z.enum(["gemini"]).default("gemini"),
    apiKey: z.string().optional(),
  }).optional(),
  extension: z.object({
    pairingToken: z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const config: FeedsiloConfig = {
      database: parsed.data.database,
      embeddings: parsed.data.embeddings || { provider: "gemini" },
      extension: parsed.data.extension || {},
      search: { keywordWeight: 0.4, semanticWeight: 0.6 },
    };

    // Write config files
    writeConfig(config);
    invalidateConfigCache();

    // Run Prisma db push
    const schemaFlag =
      config.database.type === "sqlite"
        ? "--schema=prisma/schema-sqlite.prisma"
        : "--schema=prisma/schema.prisma";

    try {
      await execAsync(`npx prisma db push ${schemaFlag} --accept-data-loss --skip-generate`, {
        env: { ...process.env, DATABASE_URL: config.database.url },
        timeout: 30000,
      });
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        error: `Migration failed: ${error.stderr || error.message}`,
      });
    }

    // For PostgreSQL, try to create pgvector extension
    if (config.database.type !== "sqlite") {
      try {
        const { default: pg } = await import("pg");
        const pool = new pg.Pool({ connectionString: config.database.url });
        const client = await pool.connect();
        await client.query("CREATE EXTENSION IF NOT EXISTS vector");
        client.release();
        await pool.end();
      } catch {
        // Non-fatal — user may not have superuser privileges
      }
    }

    // For SQLite, create FTS5 virtual table + sync triggers
    if (config.database.type === "sqlite") {
      try {
        const { SqliteSearchProvider } = await import("@/lib/db/providers/sqlite");
        const provider = new SqliteSearchProvider();
        await provider.ensureFts5Table();
      } catch (error: any) {
        // Log but don't fail — FTS5 can be created later
        console.warn("FTS5 table creation failed:", error.message);
      }
    }

    // Set cookie so middleware knows app is configured (Edge Runtime can't read fs)
    const response = NextResponse.json({ success: true });
    response.cookies.set("feedsilo-configured", "true", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365 * 10, // 10 years
    });
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/setup/migrate/route.ts
git commit -m "feat: add POST /api/setup/migrate with auto db push and FTS5 setup"
```

---

## Task 13: Verification

- [ ] **Step 1: Run tests**

Run: `npx vitest run`
Expected: All tests pass (config tests + existing hybrid.test.ts)

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | grep -E "(Compiled|Error)"`
Expected: `✓ Compiled successfully` — no new errors introduced

- [ ] **Step 3: Verify dual Prisma generation**

Run: `npm run prisma:generate`
Expected: Both schemas generate without errors

- [ ] **Step 4: Verify middleware doesn't break existing setup**

If you have a working `.env.local` with `DATABASE_URL` and `DATABASE_TYPE`, the middleware should NOT redirect to `/onboarding` — the env var check is the fast path.

Run: `npm run dev` and visit `http://localhost:3000`
Expected: Home page loads normally (not redirected to /onboarding)

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address build/test issues from chunk 1 implementation"
```
