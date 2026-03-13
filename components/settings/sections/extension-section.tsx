"use client";

import { useState } from "react";
import { TokenDisplay } from "@/components/shared/token-display";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ExtensionSectionProps { settings: any; onRefresh: () => void }

export function ExtensionSection({ settings, onRefresh }: ExtensionSectionProps) {
  const [regenerating, setRegenerating] = useState(false);
  const token = settings?.extension?.pairingToken;

  const handleRegenerate = async () => {
    if (!confirm("Any connected browser extension will need to be re-paired with the new token. Continue?")) {
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
      <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5] mb-4">
        Browser Extension
      </h3>

      <div className="flex flex-col gap-4">
        {token ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">Pairing token</label>
              <TokenDisplay token={token} />
            </div>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[#1a1a24] text-[#f0f0f5] border border-[#ffffff12] hover:border-[#ffffff24] transition-all duration-200 cursor-pointer self-start disabled:opacity-50"
            >
              {regenerating ? "Regenerating..." : "Regenerate Token"}
            </button>
          </>
        ) : (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No pairing token configured. Set one in the onboarding flow or generate one below.
          </p>
        )}

        {!token && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[var(--accent-thread)] text-[#0a0a0f] font-heading hover:brightness-110 transition-all duration-200 cursor-pointer self-start disabled:opacity-50"
          >
            {regenerating ? "Generating..." : "Generate Token"}
          </button>
        )}
      </div>
    </div>
  );
}
