"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function DemoBanner({ role }: { role?: string }) {
  const [dismissed, setDismissed] = useState(false);

  if (role !== "demo" || dismissed) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-[#b8946233] bg-[#b894621a] px-4 py-2.5 text-sm text-[#e7d5be] backdrop-blur-sm">
      <p>
        You&apos;re viewing Scrollback in demo mode.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-full p-1 text-[#b4ab9d] transition-colors hover:bg-[#ffffff14] hover:text-[#f2ede5]"
        aria-label="Dismiss banner"
      >
        <X size={14} />
      </button>
    </div>
  );
}
