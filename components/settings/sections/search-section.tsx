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
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05] p-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#d6c9b214] bg-[#0f141b]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-article)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <div>
            <h3 className="font-heading text-[15px] font-semibold text-[#f2ede5]">
            Search
          </h3>
            <p className="text-xs text-[#a49b8b]">
            Hybrid keyword + semantic search weights
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {isSqlite && (
          <div className="rounded-[12px] border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300/90">
            Semantic search is not available with SQLite. Only keyword search (FTS5) is used.
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[#8a8174]">Keyword weight</label>
              <span className="font-mono text-xs text-[#f2ede5]">{keywordWeight}%</span>
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
              <label className="text-xs text-[#8a8174]">Semantic weight</label>
              <span className="font-mono text-xs text-[#f2ede5]">{semanticWeight}%</span>
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
            className="h-9 self-start rounded-[12px] bg-[var(--accent-article)] px-4 text-sm font-medium text-[#090c11] transition-all duration-200 cursor-pointer hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Weights"}
          </button>
        </div>

        <div className="border-t border-[#d6c9b214] pt-4">
          <h4 className="mb-2 text-sm font-medium text-[#f2ede5]">Rebuild Search Index</h4>
          <p className="mb-3 text-xs text-[#a49b8b]">
            Re-index all content items. Use this after importing data or if search results seem stale.
          </p>
          <ProgressBar endpoint="/api/search/reindex" buttonLabel="Rebuild Index" />
        </div>
      </div>
    </div>
  );
}
