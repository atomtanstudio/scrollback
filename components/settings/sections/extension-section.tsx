"use client";

import { useState } from "react";
import { TokenDisplay } from "@/components/shared/token-display";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ExtensionSectionProps { settings: any; onRefresh: () => void }

export function ExtensionSection({ settings, onRefresh }: ExtensionSectionProps) {
  const [regenerating, setRegenerating] = useState(false);
  const token = settings?.extension?.pairingToken;

  const handleRegenerate = async () => {
    if (token && !confirm("Any connected browser extension will need to be re-paired with the new token. Continue?")) {
      return;
    }
    setRegenerating(true);
    try {
      await fetch("/api/settings/regenerate-token", { method: "POST" });
      onRefresh();
    } catch {
      // Silently fail
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="rounded-[14px] border border-[#ffffff0a] bg-[#111118] p-6">
      {/* Header with branding */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[var(--accent-thread)] to-[var(--accent-tweet)] flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0a0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </div>
          <div>
            <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5]">
              FeedSilo Browser Extension
            </h3>
            <p className="text-xs text-[#8888aa]">
              Capture content from X/Twitter and the web
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          token
            ? "bg-[#00ffc815] text-[#00ffc8] border border-[#00ffc830]"
            : "bg-[#ff6b3515] text-[#ff6b35] border border-[#ff6b3530]"
        }`}>
          {token ? "Paired" : "Not paired"}
        </span>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-[8px] bg-[#0a0a0f] border border-[#ffffff06] px-3 py-2.5 text-center">
          <p className="text-xs font-medium text-[#f0f0f5]">Tweets & Threads</p>
          <p className="text-[10px] text-[#8888aa] mt-0.5">One-click save</p>
        </div>
        <div className="rounded-[8px] bg-[#0a0a0f] border border-[#ffffff06] px-3 py-2.5 text-center">
          <p className="text-xs font-medium text-[#f0f0f5]">Articles</p>
          <p className="text-[10px] text-[#8888aa] mt-0.5">Full page capture</p>
        </div>
        <div className="rounded-[8px] bg-[#0a0a0f] border border-[#ffffff06] px-3 py-2.5 text-center">
          <p className="text-xs font-medium text-[#f0f0f5]">Media</p>
          <p className="text-[10px] text-[#8888aa] mt-0.5">Images & video</p>
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
          ) : (
            <p className="text-sm text-[#8888aa]">
              Generate a token to connect your browser extension.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className={`h-9 px-4 rounded-[10px] text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 ${
              token
                ? "bg-[#1a1a24] text-[#f0f0f5] border border-[#ffffff12] hover:border-[#ffffff24]"
                : "bg-[var(--accent-thread)] text-[#0a0a0f] font-heading hover:brightness-110"
            }`}
          >
            {regenerating
              ? (token ? "Regenerating..." : "Generating...")
              : (token ? "Regenerate Token" : "Generate Token")}
          </button>

          <p className="text-[10px] text-[#8888aa]">
            Copy this token into the extension&apos;s settings to pair it with this instance
          </p>
        </div>
      </div>
    </div>
  );
}
