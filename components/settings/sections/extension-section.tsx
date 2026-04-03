"use client";

import { useState } from "react";
import { TokenDisplay } from "@/components/shared/token-display";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ExtensionSectionProps { settings: any; onRefresh: () => void }

export function ExtensionSection({ settings, onRefresh }: ExtensionSectionProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const hasPairingToken = settings?.extension?.hasPairingToken || settings?.extension?.captureToken;
  const managedByEnv = false; // Tokens are now per-user in the database

  const handleRegenerate = async () => {
    if (hasPairingToken && !confirm("Any connected browser extension will need to be re-paired with the new token. Continue?")) {
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch("/api/settings/regenerate-token", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      setToken(data.token || null);
      onRefresh();
    } catch {
      // Silently fail
    } finally {
      setRegenerating(false);
    }
  };

  const handleReveal = async () => {
    setRevealing(true);
    try {
      const res = await fetch("/api/settings/reveal-token", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      setToken(data.token || null);
    } catch {
      // Silently fail
    } finally {
      setRevealing(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05] p-6">
      {/* Header with branding */}
      <div className="mb-5 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,rgba(184,148,98,0.92),rgba(110,152,160,0.92))]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0a0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </div>
          <div>
            <h3 className="font-heading text-[15px] font-semibold text-[#f2ede5]">
              FeedSilo Browser Extension
            </h3>
            <p className="text-xs text-[#a49b8b]">
              Capture content from X/Twitter and the web
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          hasPairingToken
            ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
            : "border border-amber-500/25 bg-amber-500/10 text-amber-300"
        }`}>
          {hasPairingToken ? "Paired" : "Not paired"}
        </span>
      </div>

      {/* Features */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-[14px] border border-[#d6c9b214] bg-[#0f141b] px-3 py-3 text-center">
          <p className="text-xs font-medium text-[#f2ede5]">Tweets & Threads</p>
          <p className="mt-0.5 text-[10px] text-[#8a8174]">One-click save</p>
        </div>
        <div className="rounded-[14px] border border-[#d6c9b214] bg-[#0f141b] px-3 py-3 text-center">
          <p className="text-xs font-medium text-[#f2ede5]">Articles</p>
          <p className="mt-0.5 text-[10px] text-[#8a8174]">Full page capture</p>
        </div>
        <div className="rounded-[14px] border border-[#d6c9b214] bg-[#0f141b] px-3 py-3 text-center">
          <p className="text-xs font-medium text-[#f2ede5]">Media</p>
          <p className="mt-0.5 text-[10px] text-[#8a8174]">Images & video</p>
        </div>
      </div>

      {/* Pairing token */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[hsl(var(--muted-foreground))]">
            Pairing token
          </label>
          {token ? (
            <TokenDisplay token={token} />
          ) : managedByEnv ? (
            <p className="text-sm text-[#a49b8b]">
              This token is managed by the server environment. Use your deployment&apos;s{" "}
              <code className="rounded bg-[#0f141b] px-1.5 py-0.5 text-[11px] text-[#cdc4b7]">CAPTURE_SECRET</code>{" "}
              value when pairing extensions.
            </p>
          ) : hasPairingToken ? (
            <p className="text-sm text-[#a49b8b]">
              Existing token is hidden by default. Reveal it only when you need to pair a browser.
            </p>
          ) : (
            <p className="text-sm text-[#a49b8b]">
              Generate a token to connect your browser extension.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!managedByEnv && hasPairingToken && !token && (
            <button
              onClick={handleReveal}
              disabled={revealing}
              className="h-9 rounded-[12px] border border-[#d6c9b214] bg-[#ffffff05] px-4 text-sm font-medium text-[#f2ede5] transition-all duration-200 cursor-pointer disabled:opacity-50 hover:border-[#d6c9b233]"
            >
              {revealing ? "Revealing..." : "Reveal Token"}
            </button>
          )}

          {!managedByEnv && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className={`h-9 px-4 rounded-[12px] text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 ${
                hasPairingToken
                  ? "border border-[#d6c9b214] bg-[#ffffff05] text-[#f2ede5] hover:border-[#d6c9b233]"
                  : "bg-[var(--accent-article)] text-[#090c11] font-heading hover:brightness-110"
              }`}
            >
              {regenerating
                ? (hasPairingToken ? "Regenerating..." : "Generating...")
                : (hasPairingToken ? "Regenerate Token" : "Generate Token")}
            </button>
          )}

          <p className="text-[10px] text-[#8a8174]">
            {managedByEnv
              ? "Environment-managed tokens are intentionally hidden from the settings API."
              : "Copy this token into the extension&apos;s settings to pair it with this instance"}
          </p>
        </div>
      </div>
    </div>
  );
}
