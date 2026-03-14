"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ConnectionTesterProps {
  onTest: () => Promise<{ connected: boolean; pgvector: boolean; error?: string }>;
  className?: string;
}

type TestState = "idle" | "testing" | "success" | "error";

export function ConnectionTester({ onTest, className }: ConnectionTesterProps) {
  const [state, setState] = useState<TestState>("idle");
  const [pgvector, setPgvector] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    setState("testing");
    setError(null);
    try {
      const result = await onTest();
      if (result.connected) {
        setState("success");
        setPgvector(result.pgvector);
      } else {
        setState("error");
        setError(result.error || "Connection failed");
      }
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <button
        onClick={handleTest}
        disabled={state === "testing"}
        className={cn(
          "h-10 px-5 rounded-[10px] text-sm font-medium transition-all duration-200 cursor-pointer",
          state === "success"
            ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
            : state === "error"
              ? "border border-red-500/30 bg-red-500/15 text-red-300"
              : "border border-[#d6c9b214] bg-[#ffffff05] text-[#f2ede5] hover:border-[#d6c9b233]",
          state === "testing" && "opacity-70"
        )}
      >
        {state === "testing" && (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Testing...
          </span>
        )}
        {state === "idle" && "Test Connection"}
        {state === "success" && (
          <span className="inline-flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Connected
          </span>
        )}
        {state === "error" && "Retry Connection"}
      </button>

      {/* pgvector status */}
      {state === "success" && !pgvector && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300/90">
          <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            pgvector extension not found. Semantic search will be unavailable.{" "}
            <a href="https://github.com/pgvector/pgvector#installation" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-300">
              Install pgvector
            </a>
          </span>
        </div>
      )}

      {state === "success" && pgvector && (
        <p className="text-xs text-emerald-300/90">pgvector detected: semantic search enabled</p>
      )}

      {/* Error message */}
      {state === "error" && error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300/90">
          {error}
        </p>
      )}
    </div>
  );
}
