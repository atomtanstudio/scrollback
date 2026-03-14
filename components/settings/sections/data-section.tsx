"use client";

import { useState } from "react";
import { DangerZone } from "@/components/shared/danger-zone";
import { ProgressBar } from "@/components/shared/progress-bar";

interface DataSectionProps {
  stats: { total: number; tweets: number; threads: number; articles: number; art: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings?: any;
}

export function DataSection({ stats, settings }: DataSectionProps) {
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
    <div className="rounded-[14px] border border-[#ffffff0a] bg-[#111118] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-[10px] bg-[#1a1a24] border border-[#ffffff0a] flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <div>
          <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5]">
            Data
          </h3>
          <p className="text-xs text-[#8888aa]">
            {stats.total.toLocaleString()} items captured
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" value={stats.total} color="var(--accent-thread)" />
          <StatCard label="Tweets" value={stats.tweets} color="var(--accent-tweet)" />
          <StatCard label="Threads" value={stats.threads} color="var(--accent-thread)" />
          <StatCard label="Articles" value={stats.articles} color="var(--accent-article)" />
        </div>

        {/* Media Storage (R2) */}
        {r2?.configured && (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-medium text-[#f0f0f5]">Media Storage (R2)</h4>
            {r2.mediaWithoutStored > 0 ? (
              <>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {r2.mediaWithoutStored} of {r2.mediaWithStored + r2.mediaWithoutStored} media items pending download
                </p>
                <ProgressBar
                  endpoint="/api/media/backfill"
                  buttonLabel="Download Media to R2"
                />
              </>
            ) : (
              <p className="text-xs text-emerald-400">
                All {r2.mediaWithStored} media items stored in R2
              </p>
            )}
          </div>
        )}

        {/* Export */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-[#f0f0f5]">Export</h4>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("json")}
              className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[#1a1a24] text-[#f0f0f5] border border-[#ffffff12] hover:border-[#ffffff24] transition-all duration-200 cursor-pointer"
            >
              Export JSON
            </button>
            <button
              onClick={() => handleExport("csv")}
              className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[#1a1a24] text-[#f0f0f5] border border-[#ffffff12] hover:border-[#ffffff24] transition-all duration-200 cursor-pointer"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Delete result */}
        {deleteResult && (
          <p className="text-xs text-emerald-400">{deleteResult}</p>
        )}

        {/* Danger zone */}
        <DangerZone
          title="Delete All Data"
          description="This will permanently delete all captured content, media, and search indices. Categories and tags will be preserved. This action cannot be undone."
          buttonLabel="Delete All Data"
          onConfirm={handleDelete}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-[10px] bg-[#0a0a0f] border border-[#ffffff0a] p-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">{label}</p>
      <p className="text-lg font-heading font-bold" style={{ color }}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
