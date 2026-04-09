"use client";

import { useState } from "react";
import { DangerZone } from "@/components/shared/danger-zone";
import { ProgressBar } from "@/components/shared/progress-bar";

interface DataSectionProps {
  stats: { total: number; tweets: number; threads: number; articles: number; rss: number; art: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings?: any;
  isAdmin?: boolean;
}

export function DataSection({ stats, settings, isAdmin = true }: DataSectionProps) {
  const [deleteResult, setDeleteResult] = useState<string | null>(null);
  const r2 = settings?.r2;

  const handleDelete = async () => {
    const res = await fetch("/api/data", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "DELETE" }),
    });
    const data = await res.json();
    if (data.success) {
      setDeleteResult(`Deleted ${data.deletedCount} items`);
      setTimeout(() => window.location.reload(), 1500);
    } else {
      throw new Error(data.error || "Delete failed");
    }
  };

  const handleExport = (format: "json" | "csv") => {
    window.open(`/api/export?format=${format}`, "_blank");
  };

  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05] p-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#d6c9b214] bg-[#0f141b]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-art)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <div>
            <h3 className="font-heading text-[15px] font-semibold text-[#f2ede5]">
            Data
          </h3>
            <p className="text-xs text-[#a49b8b]">
            {stats.total.toLocaleString()} items captured
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Total" value={stats.total} color="var(--accent-thread)" />
          <StatCard label="Tweets" value={stats.tweets} color="var(--accent-tweet)" />
          <StatCard label="Threads" value={stats.threads} color="var(--accent-thread)" />
          <StatCard label="Articles" value={stats.articles} color="var(--accent-article)" />
          <StatCard label="RSS" value={stats.rss} color="var(--accent-article)" />
        </div>

        {/* Media Storage (R2) — admin only */}
        {isAdmin && r2?.configured && (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-medium text-[#f2ede5]">Media Backfill (R2)</h4>
            {r2.mediaWithoutStored > 0 ? (
              <>
                <p className="text-xs text-[#a49b8b]">
                  {r2.mediaWithoutStored} of {r2.mediaWithStored + r2.mediaWithoutStored} media items are not stored yet
                </p>
                <ProgressBar
                  endpoint="/api/media/backfill"
                  buttonLabel="Backfill All Media to R2"
                />
              </>
            ) : (
              <p className="text-xs text-emerald-300">
                All {r2.mediaWithStored} media items stored in R2
              </p>
            )}
          </div>
        )}

        {/* Export */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-[#f2ede5]">Export</h4>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("json")}
              className="h-9 rounded-[12px] border border-[#d6c9b214] bg-[#ffffff05] px-4 text-sm font-medium text-[#f2ede5] transition-all duration-200 cursor-pointer hover:border-[#d6c9b233]"
            >
              Export JSON
            </button>
            <button
              onClick={() => handleExport("csv")}
              className="h-9 rounded-[12px] border border-[#d6c9b214] bg-[#ffffff05] px-4 text-sm font-medium text-[#f2ede5] transition-all duration-200 cursor-pointer hover:border-[#d6c9b233]"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Delete result + danger zone — admin only */}
        {isAdmin && (
          <>
            {deleteResult && (
              <p className="text-xs text-emerald-300">{deleteResult}</p>
            )}
            <DangerZone
              title="Delete All Data"
              description="This will permanently delete all captured content, media, and search indices. Categories and tags will be preserved. This action cannot be undone."
              buttonLabel="Delete All Data"
              onConfirm={handleDelete}
            />
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-[16px] border border-[#d6c9b214] bg-[#0f141b] p-3">
      <p className="mb-1 text-xs text-[#8a8174]">{label}</p>
      <p className="text-lg font-heading font-bold" style={{ color }}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
