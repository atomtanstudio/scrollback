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
    <div className="rounded-[20px] border border-red-500/25 bg-red-500/6 p-5">
      <h4 className="mb-1 text-sm font-semibold text-red-300">{title}</h4>
      <p className="mb-4 text-xs text-[#b4ab9d]">{description}</p>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="h-9 rounded-[12px] border border-red-500/30 bg-red-500/10 px-4 text-sm font-medium text-red-300 transition-all duration-200 cursor-pointer hover:bg-red-500/20"
        >
          {buttonLabel}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-red-300">
            Type <strong>DELETE</strong> to confirm
          </p>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            className="h-10 w-full rounded-[12px] border border-red-500/30 bg-[#0f141b] px-4 text-sm font-mono text-[#f2ede5] placeholder:text-[#6f695f] transition-colors focus:outline-none focus:border-red-500/60"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={typed !== "DELETE" || loading}
              className="h-9 rounded-[12px] bg-red-500 px-4 text-sm font-medium text-white transition-all duration-200 cursor-pointer hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {loading ? "Deleting..." : "Confirm Delete"}
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                setTyped("");
              }}
              className="h-9 rounded-[12px] px-4 text-sm font-medium text-[#a49b8b] transition-colors cursor-pointer hover:text-[#f2ede5]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
