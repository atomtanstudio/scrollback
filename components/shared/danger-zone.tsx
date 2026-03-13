"use client";

import { useState } from "react";

interface DangerZoneProps {
  title: string;
  description: string;
  buttonLabel: string;
  onConfirm: () => Promise<void>;
}

export function DangerZone({ title, description, buttonLabel, onConfirm }: DangerZoneProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (typed !== "DELETE") return;
    setLoading(true);
    try {
      await onConfirm();
      setShowConfirm(false);
      setTyped("");
    } catch {
      // Error handling done by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-red-500/30 rounded-[14px] p-5">
      <h4 className="text-sm font-semibold text-red-400 mb-1">{title}</h4>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">{description}</p>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="h-9 px-4 rounded-[10px] text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all duration-200 cursor-pointer"
        >
          {buttonLabel}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-red-400">
            Type <strong>DELETE</strong> to confirm
          </p>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            className="h-10 px-4 rounded-[10px] bg-[#0a0a0f] border border-red-500/30 text-[#f0f0f5] text-sm font-mono placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-red-500/60 transition-colors w-full"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={typed !== "DELETE" || loading}
              className="h-9 px-4 rounded-[10px] text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading ? "Deleting..." : "Confirm Delete"}
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                setTyped("");
              }}
              className="h-9 px-4 rounded-[10px] text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[#f0f0f5] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
