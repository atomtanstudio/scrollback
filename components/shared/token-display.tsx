"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TokenDisplayProps {
  token: string;
  className?: string;
}

export function TokenDisplay({ token, className }: TokenDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [token]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <code className="flex-1 bg-[#0a0a0f] border border-[#ffffff12] rounded-lg px-4 py-3 font-mono text-sm text-[var(--accent-tweet)] select-all break-all">
        {token}
      </code>
      <button
        onClick={handleCopy}
        className="shrink-0 h-10 px-4 rounded-[10px] text-sm font-medium bg-[#1a1a24] border border-[#ffffff12] text-[#f0f0f5] hover:border-[#ffffff24] transition-all duration-200 cursor-pointer"
      >
        {copied ? (
          <span className="text-emerald-400">Copied!</span>
        ) : (
          "Copy"
        )}
      </button>
    </div>
  );
}
