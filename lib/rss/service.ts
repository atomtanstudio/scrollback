import { createHash } from "crypto";
import Parser from "rss-parser";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { getClient } from "@/lib/db/client";
import { ingestItem } from "@/lib/ingest";
import type { CapturePayload } from "@/lib/db/types";

type ParsedFeed = {
  title?: string;
  description?: string;
  language?: string;
  link?: string;
  items?: ParsedFeedItem[];
};

type ParsedFeedItem = {
  title?: string;
  link?: string;
  guid?: string;
  id?: string;
  creator?: string;
  author?: string;
  isoDate?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  categories?: string[];
  enclosure?: {
    url?: string;
    type?: string;
  };
  "content:encoded"?: string;
};

const parser = new Parser<Record<string, never>, ParsedFeedItem>({
  customFields: {
    item: ["creator", "content:encoded"],
  },
});

const INITIAL_SYNC_ITEM_LIMIT = 24;
const MIN_FEED_BODY_LENGTH = 140;

function normalizeFeedUrl(feedUrl: string): string {
  const trimmed = feedUrl.trim();
  if (!trimmed) {
    throw new Error("Feed URL is required");
  }

  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(normalized);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP(S) feed URLs are supported");
  }
  return parsed.toString();
}

function deriveDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function getItemHtml(item: ParsedFeedItem): string | null {
  return item["content:encoded"] || item.content || item.summary || null;
}

function getItemText(item: ParsedFeedItem): string {
  const snippet = item.contentSnippet?.trim();
  if (snippet) return snippet;

  const html = getItemHtml(item);
  if (html) return stripHtml(html);

  return item.title?.trim() || "";
}

function isThinFeedBody(text: string, title: string | undefined): boolean {
  const cleanText = text.trim();
  const cleanTitle = (title || "").trim();
  if (!cleanText) return true;
  if (cleanText.length < MIN_FEED_BODY_LENGTH) return true;
  if (cleanTitle && cleanText === cleanTitle) return true;
  return false;
}

function extractMediaUrls(item: ParsedFeedItem): string[] {
  const urls = new Set<string>();
  const enclosureUrl = item.enclosure?.url?.trim();
  if (enclosureUrl && /^https?:\/\//i.test(enclosureUrl)) {
    urls.add(enclosureUrl);
  }

  const html = getItemHtml(item);
  if (html) {
    for (const match of Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi))) {
      const src = match[1]?.trim();
      // Only keep absolute HTTP URLs — relative paths can't be resolved without the source domain
      if (src && /^https?:\/\//i.test(src)) urls.add(src);
    }
  }

  return Array.from(urls).slice(0, 4);
}

function buildExternalId(feedId: string, item: ParsedFeedItem): string {
  const stableKey =
    item.guid?.trim() ||
    item.id?.trim() ||
    item.link?.trim() ||
    `${item.title || ""}|${item.isoDate || item.pubDate || ""}`;

  const hash = createHash("sha256").update(stableKey).digest("hex").slice(0, 24);
  return `rss:${feedId}:${hash}`;
}

async function fetchReadableArticle(url: string): Promise<{
  title: string | null;
  textContent: string | null;
  htmlContent: string | null;
  imageUrl: string | null;
}> {
  const response = await fetch(url, {
    headers: { "User-Agent": "FeedSilo RSS Fetcher/1.0" },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Article request failed with ${response.status}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();

  // Resolve a potentially relative image URL to absolute using the article's base URL
  const resolveUrl = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    try {
      return new URL(raw, url).href;
    } catch {
      return null;
    }
  };

  const articleImage =
    article?.content
      ? resolveUrl(new JSDOM(article.content, { url }).window.document.querySelector("img")?.getAttribute("src"))
      : null;
  const firstDocumentImage =
    resolveUrl(dom.window.document.querySelector("main img, article img, [data-testid='article-body'] img, img")?.getAttribute("src"));
  const imageUrl =
    articleImage ||
    firstDocumentImage ||
    resolveUrl(dom.window.document.querySelector('meta[property="og:image"]')?.getAttribute("content")) ||
    resolveUrl(dom.window.document.querySelector('meta[name="twitter:image"]')?.getAttribute("content")) ||
    null;

  return {
    title: article?.title || dom.window.document.title || null,
    textContent: article?.textContent?.trim() || null,
    htmlContent: article?.content || null,
    imageUrl,
  };
}

async function fetchParsedFeed(
  feedUrl: string,
  options: { etag?: string | null; lastModified?: string | null } = {}
): Promise<{
  status: number;
  parsed?: ParsedFeed;
  etag?: string | null;
  lastModified?: string | null;
}> {
  const headers: HeadersInit = {
    "User-Agent": "FeedSilo RSS Fetcher/1.0",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
  };

  if (options.etag) headers["If-None-Match"] = options.etag;
  if (options.lastModified) headers["If-Modified-Since"] = options.lastModified;

  const response = await fetch(feedUrl, { headers, redirect: "follow" });

  if (response.status === 304) {
    return {
      status: 304,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
    };
  }

  if (!response.ok) {
    throw new Error(`Feed request failed with ${response.status}`);
  }

  const xml = await response.text();
  const parsed = await parser.parseString(xml) as ParsedFeed;

  return {
    status: response.status,
    parsed,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };
}

export async function listRssFeeds(userId: string) {
  const prisma = await getClient();
  return prisma.rssFeed.findMany({
    where: { user_id: userId },
    orderBy: [{ updated_at: "desc" }],
    include: {
      _count: {
        select: { items: true },
      },
    },
  });
}

export async function createRssFeed(feedUrl: string, userId: string) {
  const prisma = await getClient();
  const normalizedUrl = normalizeFeedUrl(feedUrl);
  const fetched = await fetchParsedFeed(normalizedUrl);
  const parsed = fetched.parsed;

  if (!parsed?.title) {
    throw new Error("Could not parse a valid RSS or Atom feed");
  }

  return prisma.rssFeed.upsert({
    where: { user_id_feed_url: { user_id: userId, feed_url: normalizedUrl } },
    update: {
      title: parsed.title,
      description: parsed.description || null,
      language: parsed.language || null,
      site_url: parsed.link || null,
      etag: fetched.etag || null,
      last_modified: fetched.lastModified || null,
      last_error: null,
      active: true,
    },
    create: {
      feed_url: normalizedUrl,
      user_id: userId,
      title: parsed.title,
      description: parsed.description || null,
      language: parsed.language || null,
      site_url: parsed.link || null,
      etag: fetched.etag || null,
      last_modified: fetched.lastModified || null,
    },
  });
}

export async function previewRssFeed(feedUrl: string) {
  const normalizedUrl = normalizeFeedUrl(feedUrl);
  const fetched = await fetchParsedFeed(normalizedUrl);
  const parsed = fetched.parsed;

  if (!parsed?.title) {
    throw new Error("Could not parse a valid RSS or Atom feed");
  }

  const previewFeed = {
    id: "preview",
    title: parsed.title,
    site_url: parsed.link || null,
    feed_url: normalizedUrl,
  };

  const previewItems = [];
  for (const entry of (parsed.items || []).slice(0, 5)) {
    const payload = await mapFeedItemToPayload(previewFeed, entry);
    if (!payload) continue;
    previewItems.push({
      title: payload.title || "Untitled",
      source_url: payload.source_url,
      body_preview: payload.body_text.slice(0, 320),
      body_length: payload.body_text.length,
      media_count: payload.media_urls?.length || 0,
      posted_at: payload.posted_at,
    });
  }

  return {
    title: parsed.title,
    description: parsed.description || null,
    language: parsed.language || null,
    site_url: parsed.link || null,
    item_count: parsed.items?.length || 0,
    items: previewItems,
  };
}

export async function updateRssFeed(feedId: string, userId: string, data: { active?: boolean }) {
  const prisma = await getClient();
  const feed = await prisma.rssFeed.findFirst({ where: { id: feedId, user_id: userId } });
  if (!feed) throw new Error("Feed not found");
  return prisma.rssFeed.update({
    where: { id: feedId },
    data,
  });
}

export async function deleteRssFeed(feedId: string, userId: string) {
  const prisma = await getClient();
  const feed = await prisma.rssFeed.findFirst({ where: { id: feedId, user_id: userId } });
  if (!feed) throw new Error("Feed not found");
  await prisma.rssFeed.delete({ where: { id: feedId } });
}

async function mapFeedItemToPayload(
  feed: {
    id: string;
    title: string;
    site_url: string | null;
    feed_url: string;
  },
  item: ParsedFeedItem
): Promise<CapturePayload | null> {
  const originalUrl = item.link?.trim();
  const initialBodyText = getItemText(item);
  const initialTitle = item.title?.trim() || initialBodyText.slice(0, 140);

  if (!originalUrl || !initialTitle) {
    return null;
  }

  let title = initialTitle;
  let bodyText = initialBodyText;
  let bodyHtml = getItemHtml(item);
  let mediaUrls = extractMediaUrls(item);

  const isThin = isThinFeedBody(initialBodyText, initialTitle);

  if (isThin || mediaUrls.length === 0) {
    try {
      const article = await fetchReadableArticle(originalUrl);
      if (isThin) {
        if (article.title) {
          title = article.title.trim();
        }
        if (article.textContent && article.textContent.trim().length > bodyText.length) {
          bodyText = article.textContent.trim();
        }
        if (article.htmlContent && article.htmlContent.trim().length > (bodyHtml || "").length) {
          bodyHtml = article.htmlContent.trim();
        }
      }
      if (article.imageUrl && mediaUrls.length === 0) {
        mediaUrls = [article.imageUrl];
      }
    } catch (error) {
      console.warn("RSS article fetch fallback failed:", error instanceof Error ? error.message : error);
    }
  }

  return {
    external_id: buildExternalId(feed.id, item),
    source_url: originalUrl,
    source_type: "article",
    source_platform: "rss",
    source_label: feed.title,
    source_domain: deriveDomain(feed.site_url || originalUrl || feed.feed_url),
    rss_feed_id: feed.id,
    author_handle: item.creator?.trim() || item.author?.trim() || null,
    author_display_name: item.creator?.trim() || item.author?.trim() || null,
    title,
    body_text: bodyText,
    body_html: bodyHtml,
    posted_at: item.isoDate || item.pubDate || null,
    media_urls: mediaUrls,
  };
}

export async function syncRssFeed(feedId: string) {
  const prisma = await getClient();
  const feed = await prisma.rssFeed.findUnique({ where: { id: feedId } });

  if (!feed) {
    throw new Error("Feed not found");
  }

  const fetched = await fetchParsedFeed(feed.feed_url, {
    etag: feed.etag,
    lastModified: feed.last_modified,
  });

  if (fetched.status === 304) {
    await prisma.rssFeed.update({
      where: { id: feedId },
      data: {
        last_synced_at: new Date(),
        last_error: null,
        etag: fetched.etag || feed.etag,
        last_modified: fetched.lastModified || feed.last_modified,
      },
    });
    return { synced: 0, skipped: 0, errors: 0, notModified: true };
  }

  const parsed = fetched.parsed;
  if (!parsed) {
    throw new Error("Parsed feed was empty");
  }

  const entries = parsed.items || [];
  const entriesToProcess = !feed.last_synced_at ? entries.slice(0, INITIAL_SYNC_ITEM_LIMIT) : entries;
  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of entriesToProcess) {
    const payload = await mapFeedItemToPayload(feed, entry);
    if (!payload) {
      skipped++;
      continue;
    }

    try {
      const result = await ingestItem(payload, feed.user_id);
      if (result.already_exists) skipped++;
      else synced++;
    } catch (error) {
      errors++;
      console.error("RSS ingest error:", error instanceof Error ? error.message : error);
    }
  }

  await prisma.rssFeed.update({
    where: { id: feedId },
    data: {
      title: parsed.title || feed.title,
      description: parsed.description || feed.description,
      language: parsed.language || feed.language,
      site_url: parsed.link || feed.site_url,
      etag: fetched.etag || null,
      last_modified: fetched.lastModified || null,
      last_synced_at: new Date(),
      last_error: errors > 0 && synced === 0 ? "Some feed items failed to ingest" : null,
    },
  });

  return { synced, skipped, errors, notModified: false };
}

export async function syncAllRssFeeds() {
  const prisma = await getClient();
  const feeds = await prisma.rssFeed.findMany({
    where: { active: true },
    include: { _count: { select: { items: true } } },
  });
  const activeFeeds = feeds;

  let synced = 0;
  let skipped = 0;
  let errors = 0;
  let feedsProcessed = 0;

  for (const feed of activeFeeds) {
    try {
      const result = await syncRssFeed(feed.id);
      synced += result.synced;
      skipped += result.skipped;
      errors += result.errors;
      feedsProcessed++;
    } catch (error) {
      errors++;
      feedsProcessed++;
      const prisma = await getClient();
      await prisma.rssFeed.update({
        where: { id: feed.id },
        data: {
          last_error: error instanceof Error ? error.message : "Feed sync failed",
          last_synced_at: new Date(),
        },
      });
    }
  }

  return { feedsProcessed, synced, skipped, errors };
}
