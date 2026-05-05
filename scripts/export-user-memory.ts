import fs from "fs/promises";
import path from "path";
import pg from "pg";

type Args = {
  databaseUrl?: string;
  userEmail?: string;
  userId?: string;
  appUrl?: string;
  output?: string;
};

type UserSummary = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  item_count: number;
  media_count: number;
  feed_count: number;
};

type ContentItemRow = {
  id: string;
  source_type: string;
  external_id: string | null;
  author_handle: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  title: string;
  body_text: string;
  body_html: string | null;
  conversation_id: string | null;
  original_url: string | null;
  source_platform: string;
  source_label: string | null;
  source_domain: string | null;
  rss_feed_id: string | null;
  user_id: string;
  posted_at: string | null;
  likes: number | null;
  retweets: number | null;
  replies: number | null;
  views: number | null;
  has_prompt: boolean;
  prompt_text: string | null;
  prompt_type: string | null;
  language: string | null;
  translated_title: string | null;
  translated_body_text: string | null;
  ai_summary: string | null;
  raw_markdown: string;
  source_file_path: string;
  content_hash: string;
  processing_status: string;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
};

type MediaRow = {
  id: string;
  content_item_id: string;
  media_type: string;
  original_url: string;
  stored_path: string | null;
  alt_text: string | null;
  ai_description: string | null;
  position_in_content: number | null;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
};

type FeedRow = {
  id: string;
  feed_url: string;
  site_url: string | null;
  title: string;
  description: string | null;
  language: string | null;
  active: boolean;
  etag: string | null;
  last_modified: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type CategoryRow = {
  content_item_id: string;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
};

type TagRow = {
  content_item_id: string;
  id: string;
  name: string;
  slug: string;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--database-url") {
      out.databaseUrl = next;
      i += 1;
    } else if (arg === "--user-email") {
      out.userEmail = next;
      i += 1;
    } else if (arg === "--user-id") {
      out.userId = next;
      i += 1;
    } else if (arg === "--app-url") {
      out.appUrl = next;
      i += 1;
    } else if (arg === "--output") {
      out.output = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return out;
}

function printHelp(): void {
  console.log(`
Export one Scrollback user's content graph into a single JSON file.

Usage:
  npx tsx scripts/export-user-memory.ts \\
    --database-url 'postgresql://...' \\
    --user-email 'you@example.com' \\
    --app-url 'https://your-scrollback.app' \\
    --output './exports/scrollback-memory.json'

Required:
  --database-url   PostgreSQL connection string, or set DATABASE_URL
  --app-url        Public base URL used to build media URLs

User targeting:
  --user-email     Preferred. Export this user's account data
  --user-id        Alternate. Export by user UUID

Output:
  --output         Optional. Defaults to ./exports/scrollback-memory-<user>.json
`);
}

function requireArg(value: string | undefined, message: string): string {
  if (!value) {
    console.error(message);
    process.exit(1);
  }
  return value;
}

function sanitizeForFilename(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function mediaPublicUrl(appUrl: string, storedPath: string | null, originalUrl: string): string {
  const base = appUrl.replace(/\/$/, "");
  if (storedPath) {
    if (storedPath.startsWith("http")) return storedPath;
    if (storedPath.startsWith("local/")) return `${base}/api/local-media/${storedPath.slice(6)}`;
    const clean = storedPath.replace(/^\.\//, "");
    return `${base}/api/r2/${clean}`;
  }
  return originalUrl;
}

async function pickUser(client: pg.Client, args: Args): Promise<UserSummary> {
  if (args.userEmail) {
    const result = await client.query<UserSummary>(
      `
        select
          u.id,
          u.email,
          u.role,
          u.created_at::text,
          coalesce((select count(*) from content_items ci where ci.user_id = u.id), 0)::int as item_count,
          coalesce((
            select count(*)
            from media m
            join content_items ci on ci.id = m.content_item_id
            where ci.user_id = u.id
          ), 0)::int as media_count,
          coalesce((select count(*) from rss_feeds rf where rf.user_id = u.id), 0)::int as feed_count
        from users u
        where lower(u.email) = lower($1)
      `,
      [args.userEmail]
    );
    if (result.rowCount !== 1) {
      throw new Error(`No user found for email: ${args.userEmail}`);
    }
    return result.rows[0];
  }

  if (args.userId) {
    const result = await client.query<UserSummary>(
      `
        select
          u.id,
          u.email,
          u.role,
          u.created_at::text,
          coalesce((select count(*) from content_items ci where ci.user_id = u.id), 0)::int as item_count,
          coalesce((
            select count(*)
            from media m
            join content_items ci on ci.id = m.content_item_id
            where ci.user_id = u.id
          ), 0)::int as media_count,
          coalesce((select count(*) from rss_feeds rf where rf.user_id = u.id), 0)::int as feed_count
        from users u
        where u.id = $1
      `,
      [args.userId]
    );
    if (result.rowCount !== 1) {
      throw new Error(`No user found for id: ${args.userId}`);
    }
    return result.rows[0];
  }

  const result = await client.query<UserSummary>(
    `
      select
        u.id,
        u.email,
        u.role,
        u.created_at::text,
        coalesce((select count(*) from content_items ci where ci.user_id = u.id), 0)::int as item_count,
        coalesce((
          select count(*)
          from media m
          join content_items ci on ci.id = m.content_item_id
          where ci.user_id = u.id
        ), 0)::int as media_count,
        coalesce((select count(*) from rss_feeds rf where rf.user_id = u.id), 0)::int as feed_count
      from users u
      order by u.created_at asc
    `
  );

  if (result.rowCount === 1) {
    return result.rows[0];
  }

  const summaries = result.rows
    .map((row) => `${row.email} [id=${row.id}] items=${row.item_count} media=${row.media_count} feeds=${row.feed_count}`)
    .join("\n");
  throw new Error(
    `Multiple users found. Re-run with --user-email or --user-id.\n${summaries}`
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = requireArg(
    args.databaseUrl || process.env.DATABASE_URL,
    "Missing database URL. Pass --database-url or set DATABASE_URL."
  );
  const appUrl = requireArg(
    args.appUrl || process.env.NEXTAUTH_URL,
    "Missing app URL. Pass --app-url so media URLs can be generated."
  );

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const user = await pickUser(client, args);

    const feedsResult = await client.query<FeedRow>(
      `
        select
          id,
          feed_url,
          site_url,
          title,
          description,
          language,
          active,
          etag,
          last_modified,
          last_synced_at::text,
          last_error,
          created_at::text,
          updated_at::text
        from rss_feeds
        where user_id = $1
        order by created_at desc
      `,
      [user.id]
    );

    const itemsResult = await client.query<ContentItemRow>(
      `
        select
          id,
          source_type::text,
          external_id,
          author_handle,
          author_display_name,
          author_avatar_url,
          title,
          body_text,
          body_html,
          conversation_id,
          original_url,
          source_platform,
          source_label,
          source_domain,
          rss_feed_id,
          user_id,
          posted_at::text,
          likes,
          retweets,
          replies,
          views,
          has_prompt,
          prompt_text,
          prompt_type::text,
          language,
          translated_title,
          translated_body_text,
          ai_summary,
          raw_markdown,
          source_file_path,
          content_hash,
          processing_status::text,
          processing_error,
          created_at::text,
          updated_at::text
        from content_items
        where user_id = $1
        order by created_at desc
      `,
      [user.id]
    );

    const itemIds = itemsResult.rows.map((row) => row.id);
    const emptyExport = itemIds.length === 0;

    const mediaResult = emptyExport
      ? { rows: [] as MediaRow[] }
      : await client.query<MediaRow>(
          `
            select
              id,
              content_item_id,
              media_type::text,
              original_url,
              stored_path,
              alt_text,
              ai_description,
              position_in_content,
              file_size_bytes,
              width,
              height
            from media
            where content_item_id = any($1::uuid[])
            order by content_item_id, position_in_content asc nulls last, id asc
          `,
          [itemIds]
        );

    const categoryResult = emptyExport
      ? { rows: [] as CategoryRow[] }
      : await client.query<CategoryRow>(
          `
            select
              cc.content_item_id,
              c.id,
              c.name,
              c.slug,
              c.description,
              c.parent_id
            from content_categories cc
            join categories c on c.id = cc.category_id
            where cc.content_item_id = any($1::uuid[])
            order by cc.content_item_id, c.name asc
          `,
          [itemIds]
        );

    const tagResult = emptyExport
      ? { rows: [] as TagRow[] }
      : await client.query<TagRow>(
          `
            select
              ct.content_item_id,
              t.id,
              t.name,
              t.slug
            from content_tags ct
            join tags t on t.id = ct.tag_id
            where ct.content_item_id = any($1::uuid[])
            order by ct.content_item_id, t.name asc
          `,
          [itemIds]
        );

    const mediaByItem = new Map<string, Array<MediaRow & { public_url: string }>>();
    for (const row of mediaResult.rows) {
      const existing = mediaByItem.get(row.content_item_id) || [];
      existing.push({
        ...row,
        public_url: mediaPublicUrl(appUrl, row.stored_path, row.original_url),
      });
      mediaByItem.set(row.content_item_id, existing);
    }

    const categoriesByItem = new Map<string, Omit<CategoryRow, "content_item_id">[]>();
    for (const row of categoryResult.rows) {
      const existing = categoriesByItem.get(row.content_item_id) || [];
      existing.push({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        parent_id: row.parent_id,
      });
      categoriesByItem.set(row.content_item_id, existing);
    }

    const tagsByItem = new Map<string, Omit<TagRow, "content_item_id">[]>();
    for (const row of tagResult.rows) {
      const existing = tagsByItem.get(row.content_item_id) || [];
      existing.push({
        id: row.id,
        name: row.name,
        slug: row.slug,
      });
      tagsByItem.set(row.content_item_id, existing);
    }

    const items = itemsResult.rows.map((row) => ({
      ...row,
      media_items: mediaByItem.get(row.id) || [],
      categories: categoriesByItem.get(row.id) || [],
      tags: tagsByItem.get(row.id) || [],
    }));

    const payload = {
      format_version: 1,
      exported_at: new Date().toISOString(),
      source: {
        app_url: appUrl,
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
      totals: {
        feeds: feedsResult.rows.length,
        items: items.length,
        media: mediaResult.rows.length,
      },
      rss_feeds: feedsResult.rows,
      items,
    };

    const outputPath =
      args.output ||
      path.join(
        process.cwd(),
        "exports",
        `scrollback-memory-${sanitizeForFilename(user.email)}.json`
      );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");

    console.log(
      JSON.stringify(
        {
          ok: true,
          output: outputPath,
          user: payload.user,
          totals: payload.totals,
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
