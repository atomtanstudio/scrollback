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
    <div className="rounded-[14px] border border-[#ffffff0a] bg-[#111118] p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-[#1a1a24] border border-[#ffffff0a] flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          </div>
          <div>
            <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5]">
              Database
            </h3>
            <p className="text-xs text-[#8888aa]">
              {typeLabel}{db?.type === "postgresql" ? " with pgvector" : ""}
            </p>
          </div>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#00ffc815] text-[#00ffc8] border border-[#00ffc830]">
          Connected
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {db?.url && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">Connection string</label>
              <button
                onClick={() => setShowUrl(!showUrl)}
                className="text-xs text-[var(--accent-tweet)] hover:underline cursor-pointer"
              >
                {showUrl ? "Hide" : "Show"}
              </button>
            </div>
            <code className="text-xs font-mono text-[hsl(var(--muted-foreground))] bg-[#0a0a0f] border border-[#ffffff06] rounded-[8px] px-3 py-2 break-all">
              {showUrl ? db.url : "••••••••••••"}
            </code>
          </div>
        )}

        <ConnectionTester onTest={handleTest} />
      </div>
    </div>
  );
}
