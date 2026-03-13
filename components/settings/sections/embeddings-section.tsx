"use client";

import { useState } from "react";
import { ProgressBar } from "@/components/shared/progress-bar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface EmbeddingsSectionProps { settings: any; onRefresh: () => void }

export function EmbeddingsSection({ settings, onRefresh }: EmbeddingsSectionProps) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasKey = settings?.embeddings?.hasKey;

  const handleSave = async () => {
    if (!apiKey) return;
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeddings: { apiKey } }),
      });
      setApiKey("");
      onRefresh();
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[14px] border border-[#ffffff0a] bg-[#111118] p-6">
      <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5] mb-4">Embeddings</h3>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[hsl(var(--muted-foreground))]">Gemini API Key</label>
            {hasKey && (
              <span className="text-xs text-emerald-400">configured</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? "••••••••" : "Enter your Gemini API key"}
              className="flex-1 h-10 px-4 rounded-[10px] bg-[#0a0a0f] border border-[#ffffff12] text-[#f0f0f5] text-sm placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-[#ffffff30] transition-colors"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="h-10 px-3 rounded-[10px] text-xs text-[hsl(var(--muted-foreground))] border border-[#ffffff12] hover:border-[#ffffff24] transition-colors cursor-pointer"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {apiKey && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[var(--accent-thread)] text-[#0a0a0f] font-heading hover:brightness-110 transition-all duration-200 cursor-pointer self-start disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save API Key"}
          </button>
        )}

        <div className="text-xs text-[hsl(var(--muted-foreground))]">
          <span>Model: </span>
          <code className="text-[var(--accent-tweet)]">gemini-embedding-001</code>
        </div>

        <div className="border-t border-[#ffffff0a] pt-4">
          <h4 className="text-sm font-medium text-[#f0f0f5] mb-3">Generate Missing Embeddings</h4>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
            Generate vector embeddings for items that don&apos;t have them yet. Requires a Gemini API key.
          </p>
          <ProgressBar
            endpoint="/api/embeddings/generate-missing"
            buttonLabel="Generate Embeddings"
          />
        </div>
      </div>
    </div>
  );
}
