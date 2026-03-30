import pg from "pg";

/**
 * Auto-migration: adds multi-user columns (user_id, capture_token) if missing.
 * Safe to run multiple times — every step uses IF NOT EXISTS / IF EXISTS guards.
 * Call this once at app startup with the database connection string.
 */
export async function migrateMultiUser(connectionString: string): Promise<boolean> {
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // Check if migration is needed
    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'content_items' AND column_name = 'user_id'
    `);

    if (rows.length > 0) {
      // Already migrated
      return false;
    }

    console.log("[migrate] Running multi-user migration...");

    await client.query("BEGIN");

    // 1. Add capture_token to users
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS capture_token TEXT UNIQUE`);

    // 2. Generate capture tokens for existing users that don't have one
    await client.query(`UPDATE users SET capture_token = gen_random_uuid()::text WHERE capture_token IS NULL`);

    // 3. Add user_id to content_items (nullable first)
    await client.query(`ALTER TABLE content_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`);

    // 4. Add user_id to rss_feeds (nullable first)
    await client.query(`ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`);

    // 5. Backfill: assign all existing items and feeds to the first admin user
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

    // 9. Add user_id index for fast filtering
    await client.query(`CREATE INDEX IF NOT EXISTS ix_content_items_user_id ON content_items(user_id)`);

    await client.query("COMMIT");
    console.log("[migrate] Multi-user migration complete.");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}
