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

  return (
    <div className="rounded-[14px] border border-[#ffffff0a] bg-[#111118] p-6">
      <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5] mb-4">Database</h3>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm text-[#f0f0f5] capitalize">{db?.type || "Not configured"}</span>
        </div>

        {db?.url && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">Connection</label>
              <button
                onClick={() => setShowUrl(!showUrl)}
                className="text-xs text-[var(--accent-tweet)] hover:underline cursor-pointer"
              >
                {showUrl ? "Hide" : "Show"}
              </button>
            </div>
            <code className="text-xs font-mono text-[hsl(var(--muted-foreground))] bg-[#0a0a0f] rounded-lg px-3 py-2 break-all">
              {showUrl ? db.url : "••••••••••••"}
            </code>
          </div>
        )}

        <ConnectionTester onTest={handleTest} />
      </div>
    </div>
  );
}
