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
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-[#1a1a24] border border-[#ffffff0a] flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5]">
              Gemini AI
            </h3>
            <p className="text-xs text-[#8888aa]">
              Summaries, tags, image descriptions, semantic search
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          hasKey
            ? "bg-[#00ffc815] text-[#00ffc8] border border-[#00ffc830]"
            : "bg-[#ffffff08] text-[#8888aa] border border-[#ffffff12]"
        }`}>
          {hasKey ? "Active" : "Not configured"}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[hsl(var(--muted-foreground))]">API Key</label>
            {hasKey && (
              <span className="text-xs text-emerald-400">configured</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? "••••••••" : "AIza..."}
              className="flex-1 h-10 px-4 rounded-[10px] bg-[#0a0a0f] border border-[#ffffff12] text-[#f0f0f5] text-sm placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-[#ffffff30] transition-colors"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="h-10 px-3 rounded-[10px] text-xs text-[hsl(var(--muted-foreground))] border border-[#ffffff12] hover:border-[#ffffff24] transition-colors cursor-pointer"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-[#8888aa]">
              Model: <code className="text-[var(--accent-tweet)]">gemini-embedding-001</code>
            </p>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[var(--accent-thread)] hover:underline"
            >
              Get a free key &rarr;
            </a>
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

        <div className="border-t border-[#ffffff0a] pt-4">
          <h4 className="text-sm font-medium text-[#f0f0f5] mb-2">Generate Missing Embeddings</h4>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
            Generate vector embeddings for items that don&apos;t have them yet. Requires an API key.
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
