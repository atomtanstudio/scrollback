"use client";

import { useState, useEffect } from "react";

export function XApiSection() {
  const [status, setStatus] = useState<{
    connected: boolean;
    username?: string;
    expires_at?: string;
    expired?: boolean;
  } | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="rounded-[14px] border border-[#ffffff0a] bg-[#111118] p-6">
      <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5] mb-2">
        X API Integration
      </h3>
      <p className="text-xs text-[#8888aa] mb-4">
        Optional — sync bookmarks and likes via the official X API for zero account risk
      </p>

      {/* Warning banner */}
      <div className="rounded-[10px] bg-[#1a1a24] border border-[#ff6b3520] p-4 mb-4">
        <p className="text-xs text-[#ff6b35] font-medium mb-1">About account safety</p>
        <p className="text-xs text-[#8888aa] leading-relaxed">
          The browser extension intercepts X&apos;s internal API responses. While thousands use this
          approach, it technically violates X&apos;s Terms of Service. For zero account risk,
          connect via the official X API instead. Requires X API Basic plan ($200/month) from{" "}
          <a
            href="https://developer.x.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-thread)] hover:underline"
          >
            developer.x.com
          </a>.
        </p>
      </div>

      {loading ? (
        <div className="h-12 rounded-[10px] bg-[#1a1a24] animate-pulse" />
      ) : status?.connected ? (
        <div className="flex flex-col gap-4">
          {/* Connected status */}
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00ffc8]" />
            <span className="text-sm text-[#f0f0f5]">
              Connected as <span className="font-semibold">@{status.username}</span>
            </span>
            {status.expired && (
              <span className="text-xs text-[#ff6b35] bg-[#ff6b3515] px-2 py-0.5 rounded">
                Token expired
              </span>
            )}
          </div>

          {/* Sync buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => handleSync("bookmarks")}
              disabled={syncing !== null}
              className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[var(--accent-thread)] text-[#0a0a0f] font-heading hover:brightness-110 transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {syncing === "bookmarks" ? "Syncing..." : "Sync Bookmarks"}
            </button>
            <button
              onClick={() => handleSync("likes")}
              disabled={syncing !== null}
              className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[var(--accent-thread)] text-[#0a0a0f] font-heading hover:brightness-110 transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {syncing === "likes" ? "Syncing..." : "Sync Likes"}
            </button>
          </div>

          {/* Sync result */}
          {syncResult && (
            <p className={`text-xs ${syncResult.startsWith("Error") || syncResult.startsWith("Failed") ? "text-[#ff4444]" : "text-[#00ffc8]"}`}>
              {syncResult}
            </p>
          )}

          {/* Disconnect */}
          <button
            onClick={handleDisconnect}
            className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[#1a1a24] text-[#ff6b35] border border-[#ff6b3530] hover:border-[#ff6b3560] transition-all duration-200 cursor-pointer self-start"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#8888aa]">
            Not connected. You&apos;ll need a Client ID and Client Secret from your X Developer Portal app.
            Set <code className="text-xs bg-[#1a1a24] px-1.5 py-0.5 rounded text-[#8888aa]">XAPI_CLIENT_ID</code>,{" "}
            <code className="text-xs bg-[#1a1a24] px-1.5 py-0.5 rounded text-[#8888aa]">XAPI_CLIENT_SECRET</code>, and{" "}
            <code className="text-xs bg-[#1a1a24] px-1.5 py-0.5 rounded text-[#8888aa]">XAPI_ENCRYPTION_KEY</code>{" "}
            in your <code className="text-xs bg-[#1a1a24] px-1.5 py-0.5 rounded text-[#8888aa]">.env.local</code> file.
          </p>
          <button
            onClick={handleConnect}
            className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[var(--accent-thread)] text-[#0a0a0f] font-heading hover:brightness-110 transition-all duration-200 cursor-pointer self-start"
          >
            Connect X Account
          </button>
        </div>
      )}
    </div>
  );
}
