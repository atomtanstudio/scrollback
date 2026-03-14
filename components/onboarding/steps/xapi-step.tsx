"use client";

import { useState } from "react";
import {
  onboardingHeadingClass,
  onboardingInputClass,
  onboardingLabelClass,
  onboardingNoteClass,
  onboardingPanelClass,
  onboardingPrimaryButtonClass,
  onboardingSubheadingClass,
  onboardingTextButtonClass,
  StepBadge,
} from "../ui";

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
      <StepBadge tone="recommended">Recommended</StepBadge>

      <h2 className={onboardingHeadingClass}>X API Integration</h2>
      <p className={`${onboardingSubheadingClass} mb-8 mt-4 max-w-[480px]`}>
        The official X API keeps your account safe. The extension works without
        it, but we strongly recommend it.
      </p>

      <div className="mb-8 grid w-full max-w-[480px] grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={`${onboardingPanelClass} text-left`}>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#8c7f9f]" />
            <span className="text-sm font-medium text-[#f2ede5]">
              Without X API
            </span>
          </div>
          <p className={onboardingNoteClass}>
            Extension intercepts X&apos;s internal API. Works well but technically
            violates X&apos;s ToS. Small risk of account restrictions.
          </p>
        </div>

        <div className={`${onboardingPanelClass} text-left`}>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[#b89462]" />
            <span className="text-sm font-medium text-[#f2ede5]">
              With X API
            </span>
          </div>
          <p className={onboardingNoteClass}>
            Official API - sync bookmarks and likes with zero account risk.
            Pay-as-you-go, typically around $5 per month.
          </p>
        </div>
      </div>

      <div className="mb-4 w-full max-w-[480px]">
        <label className={onboardingLabelClass}>Bearer Token</label>
        <input
          type="password"
          value={bearerToken}
          onChange={(e) => setBearerToken(e.target.value)}
          placeholder="AAAAAAAAAAAAAAAAAAA..."
          className={onboardingInputClass}
        />
        <p className={`${onboardingNoteClass} mt-2 text-left`}>
          Create a project in the Developer Portal, generate a Bearer Token, and
          paste it above.
        </p>
      </div>

      <a
        href="https://developer.x.com/en/portal/products"
        target="_blank"
        rel="noopener noreferrer"
        className={`${onboardingTextButtonClass} mb-6`}
      >
        Get X API access (pay-as-you-go) &rarr;
      </a>

      <p className={`${onboardingNoteClass} mb-6 max-w-[400px]`}>
        Your token is stored locally. It is only used to fetch your own
        bookmarks and likes and is never shared elsewhere.
      </p>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!bearerToken || saving}
          className={onboardingPrimaryButtonClass}
        >
          {saving ? "Saving..." : "Save & Continue"}
        </button>
        <button onClick={onContinue} className={onboardingTextButtonClass}>
          Continue without X API
        </button>
      </div>
    </div>
  );
}
