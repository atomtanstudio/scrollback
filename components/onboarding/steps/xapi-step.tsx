"use client";

import { useState } from "react";

interface XApiStepProps {
  onContinue: () => void;
}

export function XApiStep({ onContinue }: XApiStepProps) {
  const [bearerToken, setBearerToken] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xapi: { bearerToken } }),
      });
      onContinue();
    } catch {
      onContinue();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      {/* Badge */}
      <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#fb923c20] text-[#fb923c] border border-[#fb923c30] mb-4">
        Recommended
      </span>

      <h2 className="font-heading font-extrabold text-2xl md:text-3xl tracking-tight text-[#f0f0f5] mb-2">
        X API Integration
      </h2>
      <p className="text-[hsl(var(--muted-foreground))] text-sm mb-8 max-w-[480px]">
        The official X API keeps your account safe. The extension works without it,
        but we strongly recommend it.
      </p>

      {/* Comparison cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 w-full max-w-[480px]">
        {/* Without X API */}
        <div className="rounded-[10px] bg-[#111118] border border-[#ff6b3520] p-4 text-left">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#ff6b35]" />
            <span className="text-sm font-medium text-[#f0f0f5]">Without X API</span>
          </div>
          <p className="text-xs text-[#8888aa] leading-relaxed">
            Extension intercepts X&apos;s internal API. Works well but technically
            violates X&apos;s ToS. Small risk of account restrictions.
          </p>
        </div>

        {/* With X API */}
        <div className="rounded-[10px] bg-[#111118] border border-[#00ffc830] p-4 text-left">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#00ffc8]" />
            <span className="text-sm font-medium text-[#f0f0f5]">With X API</span>
          </div>
          <p className="text-xs text-[#8888aa] leading-relaxed">
            Official API — sync bookmarks &amp; likes with zero account risk.
            Pay-as-you-go, typically ~$5/month.
          </p>
        </div>
      </div>

      {/* Bearer token input */}
      <div className="w-full max-w-[480px] mb-4">
        <label className="text-[13px] font-medium text-[#f0f0f5] mb-2 block text-left">
          Bearer Token
        </label>
        <input
          type="password"
          value={bearerToken}
          onChange={(e) => setBearerToken(e.target.value)}
          placeholder="AAAAAAAAAAAAAAAAAAA..."
          className="w-full h-10 px-4 rounded-[10px] bg-[#0a0a0f] border border-[#ffffff12] text-[#f0f0f5] text-sm placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-[#ffffff30] transition-colors"
        />
        <p className="text-xs text-[#8888aa] mt-2 text-left">
          Create a project in the Developer Portal &rarr; generate a Bearer Token &rarr; paste above
        </p>
      </div>

      {/* Get key link */}
      <a
        href="https://developer.x.com/en/portal/products"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-[var(--accent-thread)] hover:underline mb-6"
      >
        Get X API access (pay-as-you-go) &rarr;
      </a>

      {/* Privacy note */}
      <p className="text-xs text-[#8888aa] mb-6 max-w-[400px]">
        Your token is stored locally. It&apos;s only used to fetch your own
        bookmarks and likes — never shared or transmitted elsewhere.
      </p>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!bearerToken || saving}
          className="h-12 px-8 rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold text-[15px] hover:brightness-110 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-default"
        >
          {saving ? "Saving..." : "Save & Continue"}
        </button>
        <button
          onClick={onContinue}
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[#f0f0f5] transition-colors cursor-pointer"
        >
          Continue without X API
        </button>
      </div>
    </div>
  );
}
