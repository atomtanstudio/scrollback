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
      <code className="flex-1 select-all break-all rounded-[12px] border border-[#d6c9b214] bg-[#0f141b] px-4 py-3 font-mono text-sm text-[var(--accent-tweet)]">
        {token}
      </code>
      <button
        onClick={handleCopy}
        className="h-10 shrink-0 rounded-[12px] border border-[#d6c9b214] bg-[#ffffff05] px-4 text-sm font-medium text-[#f2ede5] transition-all duration-200 cursor-pointer hover:border-[#d6c9b233]"
      >
        {copied ? (
          <span className="text-emerald-300">Copied!</span>
        ) : (
          "Copy"
        )}
      </button>
    </div>
  );
}
