/**
 * Pre-start migration runner.
 * Runs any pending data migrations before prisma db push.
 * Safe to run multiple times — all steps are idempotent.
 *
 * Usage: npx tsx scripts/migrate.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.log("[migrate] No DATABASE_URL set, skipping migration.");
  process.exit(0);
}

// Only run for PostgreSQL
if (!DATABASE_URL.startsWith("postgres")) {
  console.log("[migrate] Not a PostgreSQL database, skipping.");
  process.exit(0);
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // Check if users table exists (might be a fresh install)
    const { rows: userTable } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'users'
    `);

    if (userTable.length === 0) {
      console.log("[migrate] No users table yet (fresh install), skipping.");
      return;
    }

    // Check which parts of the migration are needed
    const { rows: ciCol } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'content_items' AND column_name = 'user_id'
    `);
    const { rows: rssCol } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'rss_feeds' AND column_name = 'user_id'
    `);
    const { rows: tokenCol } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'capture_token'
    `);

    if (ciCol.length === 0 || rssCol.length === 0 || tokenCol.length === 0) {
      console.log("[migrate] Running multi-user migration...");

      await client.query("BEGIN");

      // 1. Add capture_token to users
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS capture_token TEXT UNIQUE`);

      // 2. Generate capture tokens for existing users
      await client.query(`UPDATE users SET capture_token = gen_random_uuid()::text WHERE capture_token IS NULL`);

      // 3. Add user_id to content_items (nullable first)
      await client.query(`ALTER TABLE content_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`);

      // 4. Add user_id to rss_feeds (nullable first)
      await client.query(`ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`);

      // 5. Backfill to first admin user
      await client.query(`UPDATE content_items SET user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) WHERE user_id IS NULL`);
      await client.query(`UPDATE rss_feeds SET user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) WHERE user_id IS NULL`);

      // 6. Make user_id NOT NULL
      await client.query(`ALTER TABLE content_items ALTER COLUMN user_id SET NOT NULL`);
      await client.query(`ALTER TABLE rss_feeds ALTER COLUMN user_id SET NOT NULL`);

      // 7. Drop old unique constraints
      await client.query(`ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_source_file_path_key`);
      await client.query(`ALTER TABLE rss_feeds DROP CONSTRAINT IF EXISTS rss_feeds_feed_url_key`);

      // 8. Add new compound unique constraints
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_content_items_user_source ON content_items(user_id, source_file_path)`);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_rss_feeds_user_url ON rss_feeds(user_id, feed_url)`);

      // 9. Add user_id index
      await client.query(`CREATE INDEX IF NOT EXISTS ix_content_items_user_id ON content_items(user_id)`);

      await client.query("COMMIT");
      console.log("[migrate] Multi-user migration complete.");
    } else {
      console.log("[migrate] Multi-user migration already applied.");
    }

    // --- Performance indexes (idempotent) ---
    console.log("[migrate] Ensuring performance indexes...");
    await client.query(`CREATE INDEX IF NOT EXISTS ix_content_items_source_type ON content_items(source_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS ix_content_items_processing_status ON content_items(processing_status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS ix_content_items_posted_at ON content_items(posted_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS ix_content_items_created_at ON content_items(created_at)`);
    console.log("[migrate] Performance indexes done.");

    // The embedding column uses pgvector. A plain btree index on vector values is invalid
    // for realistic row sizes and causes every embedding write to fail with
    // "index row size exceeds btree maximum". Semantic search still works without
    // this index at our current scale, so proactively remove the broken index.
    console.log("[migrate] Dropping invalid vector btree index if present...");
    await client.query(`DROP INDEX IF EXISTS idx_content_items_embedding`);
    console.log("[migrate] Vector index cleanup done.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[migrate] Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
