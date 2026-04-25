import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockIngestItem = vi.fn();

vi.mock("@/lib/db/client", () => ({
  getClient: vi.fn().mockResolvedValue({
    rssFeed: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  }),
}));

vi.mock("@/lib/ingest", () => ({
  ingestItem: (...args: unknown[]) => mockIngestItem(...args),
}));

const feedXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Example Feed</title>
    <link>https://example.com</link>
    <description>Feed for testing</description>
    <item>
      <title>First RSS Item</title>
      <link>https://example.com/post-1</link>
      <guid>post-1</guid>
      <pubDate>Sat, 25 Apr 2026 10:00:00 GMT</pubDate>
      <description>${"A useful feed body. ".repeat(12)}</description>
    </item>
  </channel>
</rss>`;

function hasHeader(headers: HeadersInit | undefined, name: string): boolean {
  if (!headers) return false;
  if (headers instanceof Headers) return headers.has(name);
  if (Array.isArray(headers)) {
    return headers.some(([key]) => key.toLowerCase() === name.toLowerCase());
  }
  return Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());
}

describe("syncRssFeed", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockUpsert.mockReset();
    mockIngestItem.mockReset();
    vi.unstubAllGlobals();
  });

  it("does not store feed validators before any items are imported", async () => {
    mockUpsert.mockResolvedValue({ id: "feed-1", title: "Example Feed" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(feedXml, {
          status: 200,
          headers: {
            "content-type": "application/rss+xml",
            etag: '"metadata-only-validator"',
            "last-modified": "Sat, 25 Apr 2026 09:00:00 GMT",
          },
        })
      )
    );

    const { createRssFeed } = await import("@/lib/rss/service");

    await createRssFeed("https://example.com/feed.xml", "user-1");

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.not.objectContaining({
          etag: expect.any(String),
          last_modified: expect.any(String),
        }),
        update: expect.not.objectContaining({
          etag: expect.any(String),
          last_modified: expect.any(String),
        }),
      })
    );
  });

  it("imports initial items even when the feed has validators from being added", async () => {
    mockFindUnique.mockResolvedValue({
      id: "feed-1",
      feed_url: "https://example.com/feed.xml",
      site_url: "https://example.com",
      title: "Example Feed",
      description: "Feed for testing",
      language: null,
      user_id: "user-1",
      etag: '"already-seen-at-add-time"',
      last_modified: "Sat, 25 Apr 2026 09:00:00 GMT",
      last_synced_at: null,
      _count: { items: 0 },
    });
    mockUpdate.mockResolvedValue({});
    mockIngestItem.mockResolvedValue({ success: true, already_exists: false, item_id: "item-1" });

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      if (href === "https://example.com/feed.xml") {
        if (
          hasHeader(init?.headers, "if-none-match") ||
          hasHeader(init?.headers, "if-modified-since")
        ) {
          return new Response(null, { status: 304 });
        }

        return new Response(feedXml, {
          status: 200,
          headers: {
            "content-type": "application/rss+xml",
            etag: '"already-seen-at-add-time"',
            "last-modified": "Sat, 25 Apr 2026 09:00:00 GMT",
          },
        });
      }

      return new Response("<html><body><article><p>Full article body.</p></article></body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { syncRssFeed } = await import("@/lib/rss/service");

    const result = await syncRssFeed("feed-1");

    expect(result).toMatchObject({ synced: 1, skipped: 0, errors: 0, notModified: false });
    expect(mockIngestItem).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/feed.xml",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          "If-None-Match": expect.any(String),
          "If-Modified-Since": expect.any(String),
        }),
      })
    );
  });
});
