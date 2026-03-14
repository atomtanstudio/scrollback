"use client";

import { useState } from "react";
import { ConnectionTester } from "@/components/shared/connection-tester";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DatabaseSectionProps { settings: any; onRefresh: () => void }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DatabaseSection({ settings, onRefresh }: DatabaseSectionProps) {
  const [showUrl, setShowUrl] = useState(false);
  const db = settings?.database;

  const handleTest = async () => {
    const res = await fetch("/api/setup/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: db?.type, url: db?.url }),
    });
    return res.json();
  };

  const typeLabel = db?.type === "postgresql" ? "PostgreSQL" : db?.type === "supabase" ? "Supabase" : db?.type === "sqlite" ? "SQLite" : "Not configured";

  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05] p-6">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#d6c9b214] bg-[#0f141b]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-tweet)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          </div>
          <div>
            <h3 className="font-heading text-[15px] font-semibold text-[#f2ede5]">
              Database
            </h3>
            <p className="text-xs text-[#a49b8b]">
              {typeLabel}{db?.type === "postgresql" ? " with pgvector" : ""}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
          Connected
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {db?.url && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#8a8174]">Connection string</label>
              <button
                onClick={() => setShowUrl(!showUrl)}
                className="cursor-pointer text-xs text-[var(--accent-article)] hover:underline"
              >
                {showUrl ? "Hide" : "Show"}
              </button>
            </div>
            <code className="break-all rounded-[12px] border border-[#d6c9b214] bg-[#0f141b] px-3 py-2 text-xs font-mono text-[#b4ab9d]">
              {showUrl ? db.url : "••••••••••••"}
            </code>
          </div>
        )}

        <ConnectionTester onTest={handleTest} />
      </div>
    </div>
  );
}
