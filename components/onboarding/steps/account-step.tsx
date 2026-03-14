"use client";

import { useState } from "react";

interface AccountStepProps {
  onContinue: () => void;
}

export function AccountStep({ onContinue }: AccountStepProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const passwordsMatch = password === confirmPassword;
  const passwordLongEnough = password.length >= 8;
  const canSubmit =
    email && password && confirmPassword && passwordsMatch && passwordLongEnough;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onContinue();
      } else {
        setError(data.error || "Failed to create account");
      }
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      {/* Badge */}
      <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#a78bfa20] text-[#a78bfa] border border-[#a78bfa30] mb-4">
        Optional
      </span>

      <h2 className="font-heading font-extrabold text-2xl md:text-3xl tracking-tight text-[#f0f0f5] mb-2">
        Create Admin Account
      </h2>
      <p className="text-[hsl(var(--muted-foreground))] text-sm mb-8 max-w-[480px]">
        Set up your login credentials to protect settings and admin features.
      </p>

      {/* Form */}
      <div className="w-full max-w-[480px] mb-4 flex flex-col gap-4">
        <div>
          <label className="text-[13px] font-medium text-[#f0f0f5] mb-2 block text-left">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            placeholder="you@example.com"
            className="w-full h-10 px-4 rounded-[10px] bg-[#0a0a0f] border border-[#ffffff12] text-[#f0f0f5] text-sm placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-[#ffffff30] transition-colors"
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-[#f0f0f5] mb-2 block text-left">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="Minimum 8 characters"
            className="w-full h-10 px-4 rounded-[10px] bg-[#0a0a0f] border border-[#ffffff12] text-[#f0f0f5] text-sm placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-[#ffffff30] transition-colors"
          />
          {password && !passwordLongEnough && (
            <p className="text-xs mt-1 text-left text-[#ff4444]">
              Password must be at least 8 characters
            </p>
          )}
        </div>

        <div>
          <label className="text-[13px] font-medium text-[#f0f0f5] mb-2 block text-left">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError("");
            }}
            placeholder="Re-enter your password"
            className="w-full h-10 px-4 rounded-[10px] bg-[#0a0a0f] border border-[#ffffff12] text-[#f0f0f5] text-sm placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-[#ffffff30] transition-colors"
          />
          {confirmPassword && !passwordsMatch && (
            <p className="text-xs mt-1 text-left text-[#ff4444]">
              Passwords do not match
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-[#ff4444] mb-4">{error}</p>
      )}

      {/* Privacy note */}
      <p className="text-xs text-[#8888aa] mb-6 max-w-[400px]">
        Your credentials are stored locally in your database. Passwords are
        hashed with bcrypt and never stored in plain text.
      </p>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          className="h-12 px-8 rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold text-[15px] hover:brightness-110 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-default"
        >
          {saving ? "Creating..." : "Create Account & Continue"}
        </button>
        <button
          onClick={onContinue}
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[#f0f0f5] transition-colors cursor-pointer"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
