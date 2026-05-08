import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const dbPath = join(root, "scrollback-preview.db");
const publicAssetDir = join(root, "public", "trailer-capture");

const user = {
  id: "trailer-user-0000-4000-8000-000000000001",
  email: "trailer@scrollback.local",
  password: "scrollback-trailer-pass",
};

function slugId(prefix, slug) {
  return `${prefix}-${slug}`.slice(0, 60);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function svgCard({ title, subtitle, accent, name }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="780" viewBox="0 0 1400 780">
  <rect width="1400" height="780" rx="44" fill="#0b0f14"/>
  <rect x="64" y="64" width="1272" height="652" rx="34" fill="#121923" stroke="rgba(214,201,178,0.18)" stroke-width="3"/>
  <circle cx="1140" cy="180" r="150" fill="${accent}" opacity="0.28"/>
  <circle cx="1030" cy="520" r="240" fill="${accent}" opacity="0.12"/>
  <path d="M128 208h620M128 282h480M128 356h720" stroke="#f2ede5" stroke-width="24" stroke-linecap="round" opacity="0.84"/>
  <path d="M128 500h330M128 560h510" stroke="${accent}" stroke-width="18" stroke-linecap="round" opacity="0.78"/>
  <text x="128" y="132" fill="${accent}" font-family="Inter, system-ui, sans-serif" font-size="34" font-weight="700">${subtitle}</text>
  <text x="128" y="680" fill="#f2ede5" font-family="Inter, system-ui, sans-serif" font-size="58" font-weight="760">${title}</text>
</svg>`;
  writeFileSync(join(publicAssetDir, name), svg);
}

const categories = [
  ["developer-tools", "Developer Tools"],
  ["product-launch", "Product Launch"],
  ["research-systems", "Research Systems"],
  ["ai-automation", "AI Automation"],
  ["self-hosting", "Self Hosting"],
  ["design-reference", "Design Reference"],
];

const tags = [
  ["launch-systems", "launch systems"],
  ["agent-memory", "agent memory"],
  ["semantic-search", "semantic search"],
  ["rss-archive", "rss archive"],
  ["x-twitter-capture", "x/twitter capture"],
  ["media-storage", "media storage"],
  ["export-api", "export api"],
  ["prompt-library", "prompt library"],
  ["private-archive", "private archive"],
  ["design-reference", "design reference"],
];

const items = [
  {
    id: "trailer-capture-home",
    type: "thread",
    platform: "x",
    title: "Launch systems worth saving",
    author: "maya",
    display: "Maya Chen",
    body: "Launch thread: capture the idea, the context, the replies, and the links before the timeline moves on. This is exactly the kind of signal Scrollback keeps searchable.",
    summary: "A practical thread about launch systems, capture flows, and retaining context after social posts disappear from the timeline.",
    tags: ["launch-systems", "x-twitter-capture", "private-archive"],
    categories: ["product-launch", "research-systems"],
    likes: 842,
    views: 42000,
    conversation: "launch-thread",
    minutesAgo: 8,
    media: { file: "launch-thread.svg", title: "Launch thread", subtitle: "X / Twitter capture", accent: "#8c7f9f" },
  },
  {
    id: "trailer-detail-enrich",
    type: "article",
    platform: "web",
    title: "Building a private launch-memory system",
    author: "scrollbacklab",
    display: "Scrollback Lab",
    body: "A launch archive is more than bookmarks. It needs summaries, smart tags, durable source metadata, related items, and exportable context so a team can recover what mattered months later.",
    html: "<h2 id=\"capture\">Capture</h2><p>A launch archive is more than bookmarks.</p><h2 id=\"enrichment\">Enrichment</h2><p>Summaries, smart tags, categories, and related items keep the archive useful.</p><h2 id=\"ownership\">Ownership</h2><p>Self-hosted storage keeps the library private and portable.</p>",
    summary: "Explains how Scrollback turns saved launch research into a private, searchable library with AI summaries, tags, categories, related items, and export-ready context.",
    tags: ["launch-systems", "semantic-search", "agent-memory", "export-api", "private-archive"],
    categories: ["developer-tools", "product-launch", "ai-automation"],
    likes: 512,
    views: 18800,
    minutesAgo: 14,
    media: { file: "tagged-detail.svg", title: "Tags + summary", subtitle: "AI enrichment", accent: "#b89462" },
  },
  {
    id: "trailer-search-result",
    type: "tweet",
    platform: "x",
    title: "Search by meaning, not by memory",
    author: "nora",
    display: "Nora Vale",
    body: "The best archive search combines exact words with the things you half-remember: topic, author, source type, tags, and the summary you generated later.",
    summary: "Search guidance for archives that combine saved text, tags, summaries, and source filters.",
    tags: ["semantic-search", "agent-memory", "launch-systems"],
    categories: ["developer-tools", "research-systems"],
    likes: 1280,
    views: 61000,
    minutesAgo: 18,
  },
  {
    id: "trailer-rss-entry",
    type: "article",
    platform: "rss",
    label: "Signal Review",
    domain: "signalreview.example",
    title: "RSS feeds as durable research inputs",
    author: "Signal Review",
    display: "Signal Review",
    body: "RSS turns recurring sources into a steady stream of saved context. Scrollback keeps feed entries alongside posts, threads, media, and notes.",
    summary: "RSS feed entries can become first-class research saves inside the same private archive.",
    tags: ["rss-archive", "private-archive"],
    categories: ["research-systems"],
    likes: 91,
    views: 7000,
    minutesAgo: 26,
    media: { file: "rss-entry.svg", title: "RSS entry", subtitle: "Feed sync", accent: "#d0a266" },
  },
  {
    id: "trailer-media-storage",
    type: "tweet",
    platform: "x",
    title: "Media belongs with the note",
    author: "eliot",
    display: "Eliot Harper",
    body: "Screenshots, images, GIFs, and videos should stay attached to the save. The context is the post plus the media, not one or the other.",
    summary: "A note about storing media together with the source post.",
    tags: ["media-storage", "x-twitter-capture"],
    categories: ["self-hosting"],
    likes: 401,
    views: 22500,
    minutesAgo: 34,
    media: { file: "media-storage.svg", title: "Private media", subtitle: "Images / video / GIFs", accent: "#74a6a0" },
  },
  {
    id: "trailer-export-api",
    type: "article",
    platform: "web",
    domain: "docs.scrollback.local",
    title: "Export APIs for agent workflows",
    author: "Scrollback Docs",
    display: "Scrollback Docs",
    body: "A private library becomes more useful when scripts, Obsidian, and agents can query it without touching the database directly.",
    summary: "Remote query APIs make saved context available to local tools and agent workflows.",
    tags: ["export-api", "agent-memory", "private-archive"],
    categories: ["developer-tools", "self-hosting"],
    likes: 303,
    views: 15020,
    minutesAgo: 42,
  },
  {
    id: "trailer-prompt-library",
    type: "image_prompt",
    platform: "x",
    title: "A visual prompt worth keeping",
    author: "iris",
    display: "Iris Kim",
    body: "Prompt: editorial product render, graphite UI, warm amber highlights, quiet Apple launch trailer lighting, premium self-hosted archive.",
    summary: "An AI art prompt saved as reusable visual research.",
    tags: ["prompt-library", "design-reference"],
    categories: ["design-reference"],
    likes: 219,
    views: 11400,
    minutesAgo: 55,
    media: { file: "prompt-library.svg", title: "Prompt library", subtitle: "AI art research", accent: "#c07b88" },
  },
  {
    id: "trailer-source-filters",
    type: "article",
    platform: "web",
    domain: "archivepatterns.example",
    title: "Source filters keep archives navigable",
    author: "Archive Patterns",
    display: "Archive Patterns",
    body: "Tweets, threads, RSS, articles, and prompt saves need different visual rhythms. Good source filters let each format keep its shape.",
    summary: "Source filters help an archive keep different saved formats easy to scan.",
    tags: ["private-archive", "rss-archive"],
    categories: ["research-systems"],
    likes: 144,
    views: 9900,
    minutesAgo: 63,
    media: { file: "source-filters.svg", title: "Source filters", subtitle: "Articles / threads / RSS", accent: "#9b8cc2" },
  },
];

mkdirSync(publicAssetDir, { recursive: true });
for (const item of items) {
  if (item.media) svgCard({ ...item.media, name: item.media.file });
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const passwordHash = await bcrypt.hash(user.password, 10);

const tx = db.transaction(() => {
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, pinned_filters, created_at)
    VALUES (@id, @email, @password_hash, 'admin', @pinned_filters, CURRENT_TIMESTAMP)
    ON CONFLICT(email) DO UPDATE SET
      password_hash=excluded.password_hash,
      role='admin',
      pinned_filters=excluded.pinned_filters
  `).run({
    id: user.id,
    email: user.email,
    password_hash: passwordHash,
    pinned_filters: JSON.stringify([
      { kind: "tag", value: "product-launch", label: "Product Launch" },
      { kind: "tag", value: "agent-memory", label: "Agent Memory" },
      { kind: "type", value: "art", label: "Art" },
    ]),
  });

  const existing = db.prepare("SELECT id FROM content_items WHERE user_id = ?").all(user.id);
  for (const row of existing) {
    db.prepare("DELETE FROM media WHERE content_item_id = ?").run(row.id);
    db.prepare("DELETE FROM content_tags WHERE content_item_id = ?").run(row.id);
    db.prepare("DELETE FROM content_categories WHERE content_item_id = ?").run(row.id);
    db.prepare("DELETE FROM content_items WHERE id = ?").run(row.id);
  }

  for (const [slug, name] of categories) {
    db.prepare(`
      INSERT INTO categories (id, slug, name, description)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET name=excluded.name, description=excluded.description
    `).run(slugId("cat", slug), slug, name, `${name} saves`);
  }

  for (const [slug, name] of tags) {
    db.prepare(`
      INSERT INTO tags (id, slug, name)
      VALUES (?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET name=excluded.name
    `).run(slugId("tag", slug), slug, name);
  }

  for (const item of items) {
    const created = isoMinutesAgo(item.minutesAgo);
    const posted = isoMinutesAgo(item.minutesAgo + 60);
    const sourceFile = `trailer/${item.id}.md`;
    db.prepare(`
      INSERT INTO content_items (
        id, user_id, source_type, external_id, author_handle, author_display_name,
        title, body_text, body_html, conversation_id, original_url, source_platform,
        source_label, source_domain, posted_at, likes, retweets, replies, views,
        has_prompt, prompt_text, prompt_type, ai_summary, raw_markdown, source_file_path,
        content_hash, processing_status, created_at, updated_at
      ) VALUES (
        @id, @user_id, @source_type, @external_id, @author_handle, @author_display_name,
        @title, @body_text, @body_html, @conversation_id, @original_url, @source_platform,
        @source_label, @source_domain, @posted_at, @likes, @retweets, @replies, @views,
        @has_prompt, @prompt_text, @prompt_type, @ai_summary, @raw_markdown, @source_file_path,
        @content_hash, 'indexed', @created_at, @updated_at
      )
    `).run({
      id: item.id,
      user_id: user.id,
      source_type: item.type,
      external_id: item.id,
      author_handle: item.author,
      author_display_name: item.display,
      title: item.title,
      body_text: item.body,
      body_html: item.html ?? null,
      conversation_id: item.conversation ?? null,
      original_url: item.platform === "x"
        ? `https://x.com/${item.author}/status/${hash(item.id).slice(0, 12)}`
        : `https://${item.domain ?? "scrollback.local"}/${item.id}`,
      source_platform: item.platform,
      source_label: item.label ?? null,
      source_domain: item.domain ?? null,
      posted_at: posted,
      likes: item.likes,
      retweets: Math.floor(item.likes / 8),
      replies: Math.floor(item.likes / 18),
      views: item.views,
      has_prompt: item.type === "image_prompt" ? 1 : 0,
      prompt_text: item.type === "image_prompt" ? item.body : null,
      prompt_type: item.type === "image_prompt" ? "image" : null,
      ai_summary: item.summary,
      raw_markdown: `# ${item.title}\n\n${item.body}`,
      source_file_path: sourceFile,
      content_hash: hash(`${item.id}:${item.body}`),
      created_at: created,
      updated_at: created,
    });

    for (const tagSlug of item.tags) {
      db.prepare("INSERT OR IGNORE INTO content_tags (content_item_id, tag_id) VALUES (?, ?)").run(item.id, slugId("tag", tagSlug));
    }
    for (const categorySlug of item.categories) {
      db.prepare("INSERT OR IGNORE INTO content_categories (content_item_id, category_id) VALUES (?, ?)").run(item.id, slugId("cat", categorySlug));
    }

    if (item.media) {
      db.prepare(`
        INSERT INTO media (
          id, content_item_id, media_type, original_url, alt_text, ai_description,
          position_in_content, width, height
        ) VALUES (?, ?, 'image', ?, ?, ?, 0, 1400, 780)
      `).run(
        randomUUID(),
        item.id,
        `http://localhost:3000/trailer-capture/${item.media.file}`,
        `${item.title} visual`,
        `${item.media.subtitle} visual for ${item.title}`,
      );
    }
  }

  db.prepare("DROP TRIGGER IF EXISTS content_items_fts_delete").run();
  db.prepare("DROP TRIGGER IF EXISTS content_items_fts_update").run();
  db.prepare("DROP TABLE IF EXISTS content_items_fts").run();
  db.prepare(`
    CREATE VIRTUAL TABLE IF NOT EXISTS content_items_fts USING fts5(
      title,
      body_text,
      ai_summary,
      author_handle,
      content=content_items,
      content_rowid=rowid
    )
  `).run();
  const ftsRows = db.prepare(`
    SELECT rowid, title, body_text, ai_summary, author_handle
    FROM content_items
    WHERE user_id = ?
  `).all(user.id);

  const insertFts = db.prepare(`
    INSERT INTO content_items_fts(rowid, title, body_text, ai_summary, author_handle)
    VALUES (@rowid, @title, @body_text, @ai_summary, @author_handle)
  `);
  for (const row of ftsRows) {
    insertFts.run(row);
  }
});

tx();
db.close();

console.log(`Seeded ${items.length} Scrollback trailer items`);
console.log(`Login: ${user.email} / ${user.password}`);
