"use client";

import { useState, useEffect } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface XApiSectionProps { settings: any; onRefresh: () => void }

export function XApiSection({ settings, onRefresh }: XApiSectionProps) {
  const [status, setStatus] = useState<{
    connected: boolean;
    username?: string;
    expires_at?: string;
    expired?: boolean;
  } | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bearerToken, setBearerToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);

  const hasBearerToken = settings?.xapi?.hasBearerToken;

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/xapi/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    window.location.href = "/api/xapi/authorize";
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your X API account? You can reconnect later.")) return;
    try {
      await fetch("/api/xapi/disconnect", { method: "POST" });
      setStatus({ connected: false });
      setSyncResult(null);
    } catch {
      // Silently fail
    }
  };

  const handleSync = async (type: "bookmarks" | "likes") => {
    setSyncing(type);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/xapi/sync/${type}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncResult(`Synced ${data.synced} new items, ${data.skipped} duplicates${data.errors ? `, ${data.errors} errors` : ""}`);
      } else {
        setSyncResult(`Error: ${data.error}`);
      }
    } catch (err) {
      setSyncResult(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSyncing(null);
    }
  };

  const handleSaveBearerToken = async () => {
    if (!bearerToken) return;
    setSavingToken(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xapi: { bearerToken } }),
      });
      setBearerToken("");
      setTokenSaved(true);
      setTimeout(() => setTokenSaved(false), 3000);
      onRefresh();
    } catch {
      // Silently fail
    } finally {
      setSavingToken(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05] p-6">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#d6c9b214] bg-[#0f141b]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#f0f0f5">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <div>
            <h3 className="font-heading text-[15px] font-semibold text-[#f2ede5]">
              X API
            </h3>
            <p className="text-xs text-[#a49b8b]">
              Official API for safe bookmark & like syncing
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          status?.connected
            ? "border border-emerald-500/30 bg-emerald-500/12 text-emerald-300"
            : hasBearerToken
              ? "border border-[rgba(140,127,159,0.28)] bg-[rgba(140,127,159,0.12)] text-[#c7bad6]"
              : "border border-[#d6c9b214] bg-[#ffffff08] text-[#a49b8b]"
        }`}>
          {status?.connected ? "Connected" : hasBearerToken ? "Token set" : "Not configured"}
        </span>
      </div>

      {/* Safety warning */}
      <div className="mb-5 rounded-[16px] border border-amber-500/20 bg-amber-500/10 p-4">
        <p className="text-xs leading-relaxed text-[#b4ab9d]">
          <strong className="text-[#ff6b35]">Account safety:</strong>{" "}
          Without the X API, the extension intercepts X&apos;s internal API which
          technically violates their ToS. For zero account risk, add a Bearer Token below.{" "}
          <a
            href="https://developer.x.com/en/portal/products"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-article)] hover:underline"
          >
            Get X API access &rarr;
          </a>
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Bearer Token section */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">Bearer Token</label>
              {hasBearerToken && (
                <span className="text-xs text-emerald-300">configured</span>
              )}
              {tokenSaved && (
                <span className="text-xs text-emerald-300">saved!</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                placeholder={hasBearerToken ? "••••••••" : "AAAAAAAAAAAAAAAAAAA..."}
                className="flex-1 h-10 rounded-[12px] border border-[#d6c9b214] bg-[#0f141b] px-4 text-sm text-[#f2ede5] placeholder:text-[#6f695f] focus:outline-none focus:border-[#d6c9b24d] transition-colors"
              />
              {bearerToken && (
                <button
                  onClick={handleSaveBearerToken}
                  disabled={savingToken}
                  className="h-10 rounded-[12px] bg-[var(--accent-article)] px-4 text-sm font-medium text-[#090c11] transition-all duration-200 cursor-pointer hover:brightness-110 disabled:opacity-50"
                >
                  {savingToken ? "Saving..." : "Save"}
                </button>
              )}
            </div>
            <p className="text-[10px] text-[#8a8174]">
              Create a project at developer.x.com &rarr; generate a Bearer Token &rarr; paste above
            </p>
          </div>
        </div>

        {/* OAuth connection (if available) */}
        {loading ? (
          <div className="h-10 rounded-[10px] bg-[#171d24] animate-pulse" />
        ) : status?.connected ? (
          <div className="flex flex-col gap-4 border-t border-[#d6c9b214] pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[#00ffc8]" />
                <span className="text-sm text-[#f2ede5]">
                  Connected as <span className="font-semibold">@{status.username}</span>
                </span>
                {status.expired && (
                  <span className="text-xs text-[#ff6b35] bg-[#ff6b3515] px-2 py-0.5 rounded">
                    Token expired
                  </span>
                )}
              </div>
              <button
                onClick={handleDisconnect}
                className="cursor-pointer text-xs text-[#ff6b35] hover:underline"
              >
                Disconnect
              </button>
            </div>

            {/* Sync buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => handleSync("bookmarks")}
                disabled={syncing !== null}
                className="h-9 rounded-[12px] bg-[var(--accent-article)] px-4 text-sm font-medium text-[#090c11] transition-all duration-200 cursor-pointer hover:brightness-110 disabled:opacity-50"
              >
                {syncing === "bookmarks" ? "Syncing..." : "Sync Bookmarks"}
              </button>
              <button
                onClick={() => handleSync("likes")}
                disabled={syncing !== null}
                className="h-9 rounded-[12px] bg-[var(--accent-article)] px-4 text-sm font-medium text-[#090c11] transition-all duration-200 cursor-pointer hover:brightness-110 disabled:opacity-50"
              >
                {syncing === "likes" ? "Syncing..." : "Sync Likes"}
              </button>
            </div>

            {syncResult && (
              <p className={`text-xs ${syncResult.startsWith("Error") || syncResult.startsWith("Failed") ? "text-[#ff6b35]" : "text-emerald-300"}`}>
                {syncResult}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 border-t border-[#d6c9b214] pt-4">
            <div>
              <p className="mb-1 text-xs text-[#a49b8b]">
                <strong className="text-[#f2ede5]">OAuth connection</strong> (alternative)
              </p>
              <p className="text-xs text-[#a49b8b]">
                Connect via OAuth to sync bookmarks and likes directly.
                Requires{" "}
                <code className="rounded bg-[#0f141b] px-1.5 py-0.5 text-[10px] text-[#cdc4b7]">XAPI_CLIENT_ID</code>{" "}and{" "}
                <code className="rounded bg-[#0f141b] px-1.5 py-0.5 text-[10px] text-[#cdc4b7]">XAPI_CLIENT_SECRET</code>{" "}
                in <code className="rounded bg-[#0f141b] px-1.5 py-0.5 text-[10px] text-[#cdc4b7]">.env.local</code>.
              </p>
            </div>
            <button
              onClick={handleConnect}
              className="h-9 self-start rounded-[12px] border border-[#d6c9b214] bg-[#ffffff05] px-4 text-sm font-medium text-[#f2ede5] transition-all duration-200 cursor-pointer hover:border-[#d6c9b233]"
            >
              Connect X Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
