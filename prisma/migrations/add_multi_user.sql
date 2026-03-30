-- Multi-user migration: add user_id to content_items and rss_feeds
-- Run this BEFORE prisma db push to avoid data loss

BEGIN;

-- 1. Add capture_token to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS capture_token TEXT UNIQUE;

-- 2. Generate capture tokens for existing users
UPDATE users SET capture_token = gen_random_uuid()::text WHERE capture_token IS NULL;

-- 3. Add user_id to content_items (nullable first)
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- 4. Add user_id to rss_feeds (nullable first)
ALTER TABLE rss_feeds ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- 5. Backfill: assign all existing items and feeds to the first admin user
UPDATE content_items SET user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) WHERE user_id IS NULL;
UPDATE rss_feeds SET user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) WHERE user_id IS NULL;

-- 6. Make user_id NOT NULL
ALTER TABLE content_items ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE rss_feeds ALTER COLUMN user_id SET NOT NULL;

-- 7. Drop old unique constraints
ALTER TABLE content_items DROP CONSTRAINT IF EXISTS content_items_source_file_path_key;
ALTER TABLE rss_feeds DROP CONSTRAINT IF EXISTS rss_feeds_feed_url_key;

-- 8. Add new compound unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_items_user_source ON content_items(user_id, source_file_path);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rss_feeds_user_url ON rss_feeds(user_id, feed_url);

-- 9. Add user_id index for fast filtering
CREATE INDEX IF NOT EXISTS ix_content_items_user_id ON content_items(user_id);

COMMIT;
