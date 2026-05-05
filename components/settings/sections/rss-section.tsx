"use client";

import { useEffect, useState } from "react";

interface RssFeedRecord {
  id: string;
  title: string;
  feed_url: string;
  site_url: string | null;
  description: string | null;
  language: string | null;
  active: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  _count: {
    items: number;
  };
}

interface UserOption {
  id: string;
  email: string;
  role: string;
}

interface RssPreviewItem {
  title: string;
  source_url: string;
  body_preview: string;
  body_length: number;
  media_count: number;
  posted_at: string | null;
}

interface RssPreview {
  title: string;
  description: string | null;
  language: string | null;
  site_url: string | null;
  item_count: number;
  items: RssPreviewItem[];
}

function formatSyncTime(value: string | null): string {
  if (!value) return "Never synced";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getHostname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RssSectionProps { settings: any; onRefresh: () => void; isAdmin?: boolean }

export function RssSection({ onRefresh, isAdmin = true }: RssSectionProps) {
  const [feeds, setFeeds] = useState<RssFeedRecord[]>([]);
  const [feedUrl, setFeedUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingFeedId, setSyncingFeedId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<RssPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const loadFeeds = async (userId?: string) => {
    try {
      const qs = userId ? `?userId=${userId}` : "";
      const response = await fetch(`/api/rss/feeds${qs}`);
      const data = await response.json();
      setFeeds(data.feeds || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load feeds");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/admin/users")
        .then((res) => (res.ok ? res.json() : { users: [] }))
        .then((data) => {
          const userList: UserOption[] = data.users || [];
          setUsers(userList);
          // Default to current user (first admin)
          const admin = userList.find((u: UserOption) => u.role === "admin");
          if (admin) setSelectedUserId(admin.id);
        })
        .catch(() => {});
    }
    loadFeeds();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      setLoading(true);
      loadFeeds(selectedUserId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  const handleAddFeed = async () => {
    if (!feedUrl.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/rss/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedUrl, userId: selectedUserId || undefined }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to add feed");
      }
      setFeedUrl("");
      setPreview(null);
      setMessage(`Added ${data.feed.title}`);
      await loadFeeds(selectedUserId || undefined);
      onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to add feed");
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewFeed = async () => {
    if (!feedUrl.trim()) return;
    setPreviewing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/rss/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", feedUrl }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to preview feed");
      }
      setPreview(data.preview);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to preview feed");
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };

  const handleSyncFeed = async (id: string) => {
    setSyncingFeedId(id);
    setMessage(null);
    try {
      const response = await fetch(`/api/rss/feeds/${id}/sync`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to sync feed");
      }
      setMessage(
        data.notModified
          ? "Feed is already up to date"
          : `Synced ${data.synced} new items, skipped ${data.skipped}${data.errors ? `, ${data.errors} errors` : ""}`
      );
      await loadFeeds(selectedUserId || undefined);
      onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to sync feed");
    } finally {
      setSyncingFeedId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setMessage(null);
    try {
      const response = await fetch("/api/rss/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-all" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to sync feeds");
      }
      setMessage(`Synced ${data.synced} new items across ${data.feedsProcessed} feeds`);
      await loadFeeds(selectedUserId || undefined);
      onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to sync feeds");
    } finally {
      setSyncingAll(false);
    }
  };

  const handleToggleFeed = async (feed: RssFeedRecord) => {
    setMessage(null);
    try {
      const response = await fetch(`/api/rss/feeds/${feed.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !feed.active }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update feed");
      }
      await loadFeeds();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update feed");
    }
  };

  const handleDeleteFeed = async (feed: RssFeedRecord) => {
    if (!confirm(`Remove ${feed.title}? Existing imported items will stay in the archive.`)) {
      return;
    }

    setMessage(null);
    try {
      const response = await fetch(`/api/rss/feeds/${feed.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete feed");
      }
      await loadFeeds(selectedUserId || undefined);
      onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete feed");
    }
  };

  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05] p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#d6c9b214] bg-[#0f141b] text-[#d7ae6f]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6.18 17.82a2.18 2.18 0 1 1 0-4.36 2.18 2.18 0 0 1 0 4.36Zm-2.18-9.6v3.05a8.73 8.73 0 0 1 8.73 8.73h3.05C15.78 13.2 10.8 8.22 4 8.22Zm0-5.22v3.05c7.63 0 13.95 6.32 13.95 13.95H21C21 10.7 13.3 3 4 3Z" />
            </svg>
          </div>
          <div>
            <h3 className="font-heading text-[15px] font-semibold text-[#f2ede5]">
              RSS sources
            </h3>
            <p className="text-xs text-[#a49b8b]">
              Pull trusted feeds into the same searchable archive as your saves
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={handleSyncAll}
            disabled={syncingAll || feeds.length === 0}
            className="h-9 rounded-[12px] border border-[#d6c9b214] bg-[#ffffff05] px-4 text-sm font-medium text-[#f2ede5] transition-all duration-200 cursor-pointer hover:border-[#d6c9b233] disabled:opacity-50 disabled:cursor-default"
          >
            {syncingAll ? "Syncing..." : "Sync all"}
          </button>
        )}
      </div>

      {isAdmin && users.length > 1 && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-xs font-medium text-[#a49b8b]">Managing feeds for</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="h-9 rounded-[12px] border border-[#d6c9b214] bg-[#0f141b] px-3 text-sm text-[#f2ede5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email} ({u.role})
              </option>
            ))}
          </select>
        </div>
      )}

      {isAdmin && (
        <>
          <div className="mb-5 rounded-[16px] border border-[#d6c9b214] bg-[#0f141b] p-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                type="url"
                value={feedUrl}
                onChange={(event) => setFeedUrl(event.target.value)}
                placeholder="https://example.com/feed.xml"
                className="h-11 flex-1 rounded-[12px] border border-[#d6c9b214] bg-[#111821] px-4 text-sm text-[#f2ede5] placeholder:text-[#6f695f] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
              />
              <button
                onClick={handlePreviewFeed}
                disabled={previewing || !feedUrl.trim()}
                className="h-11 rounded-[12px] border border-[#d6c9b214] bg-[#ffffff05] px-5 text-sm font-medium text-[#f2ede5] transition-all duration-200 cursor-pointer hover:border-[#d6c9b233] disabled:opacity-50 disabled:cursor-default"
              >
                {previewing ? "Previewing..." : "Preview"}
              </button>
              <button
                onClick={handleAddFeed}
                disabled={saving || !feedUrl.trim()}
                className="h-11 rounded-[12px] bg-[var(--accent-article)] px-5 text-sm font-medium text-[#090c11] transition-all duration-200 cursor-pointer hover:brightness-110 disabled:opacity-50 disabled:cursor-default"
              >
                {saving ? "Adding..." : "Add feed"}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[#8a8174]">
              Start with manual sync. The first sync imports the latest 24 entries so a new feed does not overwhelm your library.
            </p>
          </div>

          {preview && (
            <div className="mb-5 rounded-[16px] border border-[#d6c9b214] bg-[#ffffff04] p-4">
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#a49b8b]">Preview</p>
                <h4 className="mt-2 font-heading text-[1.05rem] font-semibold text-[#f2ede5]">
                  {preview.title}
                </h4>
                <p className="mt-2 text-xs text-[#8a8174]">
                  {(getHostname(preview.site_url) || preview.site_url || "Unknown source")} · {preview.item_count} visible feed entries
                  {preview.language ? ` · ${preview.language.toUpperCase()}` : ""}
                </p>
                {preview.description && (
                  <p className="mt-3 max-w-[74ch] text-sm leading-6 text-[#b4ab9d]">
                    {preview.description}
                  </p>
                )}
              </div>

              <div className="grid gap-3">
                {preview.items.map((item) => (
                  <div key={item.source_url} className="rounded-[14px] border border-[#d6c9b214] bg-[#0f141b] p-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.12em] text-[#8a8174]">
                      <span>{item.media_count > 0 ? `${item.media_count} media` : "No media"}</span>
                      <span>{item.body_length.toLocaleString()} chars</span>
                      {item.posted_at && <span>{formatSyncTime(item.posted_at)}</span>}
                    </div>
                    <p className="mt-2 font-heading text-[1rem] font-semibold leading-tight text-[#f2ede5]">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#b4ab9d]">
                      {item.body_preview || "No article body preview extracted."}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {message && (
        <p className={`mb-4 text-xs ${message.toLowerCase().includes("failed") || message.toLowerCase().includes("error") ? "text-[#ff8b7b]" : "text-emerald-300"}`}>
          {message}
        </p>
      )}

      {loading ? (
        <div className="h-28 animate-pulse rounded-[16px] bg-[#ffffff06]" />
      ) : feeds.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-[#d6c9b214] bg-[#ffffff04] px-4 py-6 text-sm text-[#a49b8b]">
          No feeds yet. Add a feed URL and Scrollback will treat it like another signal source instead of a separate reader.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {feeds.map((feed) => {
            const hostname = getHostname(feed.site_url || feed.feed_url);
            return (
              <div
                key={feed.id}
                className="rounded-[18px] border border-[#d6c9b214] bg-[#ffffff06] p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-heading text-[1.05rem] font-semibold text-[#f2ede5]">
                        {feed.title}
                      </h4>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${
                        feed.active
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-[#d6c9b214] bg-[#ffffff08] text-[#a49b8b]"
                      }`}>
                        {feed.active ? "Active" : "Paused"}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8a8174]">
                      <span>{hostname || feed.feed_url}</span>
                      <span>{feed._count.items.toLocaleString()} items</span>
                      <span>{formatSyncTime(feed.last_synced_at)}</span>
                      {feed.language && <span>{feed.language.toUpperCase()}</span>}
                    </div>

                    {feed.description && (
                      <p className="mt-3 max-w-[78ch] text-sm leading-6 text-[#b4ab9d]">
                        {feed.description}
                      </p>
                    )}

                    {feed.last_error && (
                      <p className="mt-3 text-xs text-[#ff8b7b]">
                        Last sync error: {feed.last_error}
                      </p>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSyncFeed(feed.id)}
                        disabled={syncingFeedId === feed.id}
                        className="h-9 rounded-[12px] bg-[var(--accent-article)] px-4 text-sm font-medium text-[#090c11] transition-all duration-200 cursor-pointer hover:brightness-110 disabled:opacity-50 disabled:cursor-default"
                      >
                        {syncingFeedId === feed.id ? "Syncing..." : "Sync now"}
                      </button>
                      <button
                        onClick={() => handleToggleFeed(feed)}
                        className="h-9 rounded-[12px] border border-[#d6c9b214] bg-[#ffffff05] px-4 text-sm font-medium text-[#f2ede5] transition-all duration-200 cursor-pointer hover:border-[#d6c9b233]"
                      >
                        {feed.active ? "Pause" : "Resume"}
                      </button>
                      <button
                        onClick={() => handleDeleteFeed(feed)}
                        className="h-9 rounded-[12px] border border-[#8d5f5d44] bg-[#8d5f5d14] px-4 text-sm font-medium text-[#ffb8a8] transition-all duration-200 cursor-pointer hover:border-[#8d5f5d66]"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
