"use client";

import { useState } from "react";
import { ProgressBar } from "@/components/shared/progress-bar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SearchSectionProps { settings: any; onRefresh: () => void }

export function SearchSection({ settings, onRefresh }: SearchSectionProps) {
  const [keywordWeight, setKeywordWeight] = useState(
    Math.round((settings?.search?.keywordWeight ?? 0.4) * 100)
  );
  const [semanticWeight, setSemanticWeight] = useState(
    Math.round((settings?.search?.semanticWeight ?? 0.6) * 100)
  );
  const [saving, setSaving] = useState(false);

  const isSqlite = settings?.database?.type === "sqlite";

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search: {
            keywordWeight: keywordWeight / 100,
            semanticWeight: semanticWeight / 100,
          },
        }),
      });
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
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-[10px] bg-[#1a1a24] border border-[#ffffff0a] flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <div>
          <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5]">
            Search
          </h3>
          <p className="text-xs text-[#8888aa]">
            Hybrid keyword + semantic search weights
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {isSqlite && (
          <div className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-[8px] px-3 py-2">
            Semantic search is not available with SQLite. Only keyword search (FTS5) is used.
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">Keyword weight</label>
              <span className="text-xs text-[#f0f0f5] font-mono">{keywordWeight}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={keywordWeight}
              onChange={(e) => setKeywordWeight(Number(e.target.value))}
              className="w-full accent-[var(--accent-tweet)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">Semantic weight</label>
              <span className="text-xs text-[#f0f0f5] font-mono">{semanticWeight}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={semanticWeight}
              onChange={(e) => setSemanticWeight(Number(e.target.value))}
              className="w-full accent-[var(--accent-thread)]"
              disabled={isSqlite}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[var(--accent-thread)] text-[#0a0a0f] font-heading hover:brightness-110 transition-all duration-200 cursor-pointer self-start disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Weights"}
          </button>
        </div>

        <div className="border-t border-[#ffffff0a] pt-4">
          <h4 className="text-sm font-medium text-[#f0f0f5] mb-2">Rebuild Search Index</h4>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
            Re-index all content items. Use this after importing data or if search results seem stale.
          </p>
          <ProgressBar endpoint="/api/search/reindex" buttonLabel="Rebuild Index" />
        </div>
      </div>
    </div>
  );
}
