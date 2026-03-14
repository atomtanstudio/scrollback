/**
 * Fix items with unknown/missing authors by looking up tweet IDs via X API v2.
 *
 * Usage: npx tsx scripts/fix-unknown-authors.ts [--dry-run]
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL!;
const BEARER_TOKEN = process.env.XAPI_BEARER_TOKEN!;

const dryRun = process.argv.includes("--dry-run");

function extractTweetId(url: string): string | null {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

async function lookupTweet(tweetId: string): Promise<{
  username: string;
  name: string;
  profileImageUrl: string;
} | null> {
  const url = `https://api.x.com/2/tweets/${tweetId}?expansions=author_id&user.fields=username,name,profile_image_url`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
  });

  if (!response.ok) {
    console.log(`    API error: ${response.status} ${response.statusText}`);
    return null;
  }

  const data = await response.json();
  const user = data.includes?.users?.[0];
  if (!user) {
    console.log("    No user data in response");
    return null;
  }

  return {
    username: user.username,
    name: user.name,
    profileImageUrl: user.profile_image_url?.replace("_normal", "_400x400") || null,
  };
}

async function main() {
  if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }
  if (!BEARER_TOKEN) { console.error("Missing XAPI_BEARER_TOKEN"); process.exit(1); }

  console.log(`Fix unknown authors — dry-run: ${dryRun}\n`);

  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  try {
    const { rows } = await pool.query(`
      SELECT id, original_url, author_handle, author_display_name, left(title, 60) as title
      FROM content_items
      WHERE author_handle IS NULL OR author_handle = ''
         OR author_handle = 'unknown' OR author_handle = '@unknown'
      ORDER BY created_at DESC
    `);

    console.log(`Found ${rows.length} items with unknown authors\n`);

    let fixed = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const { id, original_url, title } = rows[i];
      console.log(`[${i + 1}/${rows.length}] ${title}`);
      console.log(`    URL: ${original_url}`);

      const tweetId = extractTweetId(original_url);
      if (!tweetId) {
        console.log("    SKIP: Can't extract tweet ID\n");
        failed++;
        continue;
      }

      const user = await lookupTweet(tweetId);
      if (!user) {
        failed++;
        console.log("");
        continue;
      }

      console.log(`    Found: @${user.username} (${user.name})`);

      if (dryRun) {
        console.log("    DRY RUN — skipped\n");
        continue;
      }

      // Update the content item
      await pool.query(
        `UPDATE content_items
         SET author_handle = $1, author_display_name = $2, author_avatar_url = $3,
             original_url = $4
         WHERE id = $5`,
        [
          `@${user.username}`,
          user.name,
          user.profileImageUrl,
          // Also fix the URL from x.com/unknown/status/... to x.com/username/status/...
          original_url.replace(/x\.com\/(unknown|i\/web)\//, `x.com/${user.username}/`),
          id,
        ]
      );

      console.log(`    UPDATED\n`);
      fixed++;

      // Rate limit: X API basic tier = 100 requests/15 min
      await new Promise((r) => setTimeout(r, 1000));
    }

    console.log(`\nDone! Fixed: ${fixed}, Failed: ${failed}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
