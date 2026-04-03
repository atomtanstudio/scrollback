"use client";

import { useState } from "react";

export function AccountSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (next !== confirm) {
      setError("New passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to change password");
      } else {
        setSuccess(true);
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05] p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,rgba(184,148,98,0.92),rgba(110,152,160,0.92))]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0a0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div>
          <h3 className="font-heading text-[15px] font-semibold text-[#f2ede5]">Account</h3>
          <p className="text-xs text-[#a49b8b]">Change your login password</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#a49b8b]">Current password</label>
          <input
            type="password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
            className="h-9 rounded-[12px] border border-[#d6c9b214] bg-[#0f141b] px-3 text-sm text-[#f2ede5] placeholder:text-[#4a4540] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#a49b8b]">New password</label>
          <input
            type="password"
            value={next}
            onChange={e => setNext(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="h-9 rounded-[12px] border border-[#d6c9b214] bg-[#0f141b] px-3 text-sm text-[#f2ede5] placeholder:text-[#4a4540] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#a49b8b]">Confirm new password</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className="h-9 rounded-[12px] border border-[#d6c9b214] bg-[#0f141b] px-3 text-sm text-[#f2ede5] placeholder:text-[#4a4540] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
        {success && (
          <p className="text-xs text-emerald-400">Password changed successfully</p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded-[12px] bg-[var(--accent-article)] px-4 text-sm font-medium font-heading text-[#090c11] transition-all duration-200 hover:brightness-110 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving..." : "Change Password"}
          </button>
        </div>
      </form>
    </div>
  );
}
