"use client";

import { useState } from "react";
import {
  onboardingHeadingClass,
  onboardingInputClass,
  onboardingLabelClass,
  onboardingNoteClass,
  onboardingPanelClass,
  onboardingPrimaryButtonClass,
  onboardingSecondaryButtonClass,
  onboardingSubheadingClass,
  onboardingTextButtonClass,
  StepBadge,
} from "../ui";

interface GeminiStepProps {
  onContinue: () => void;
}

export function GeminiStep({ onContinue }: GeminiStepProps) {
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleTest = async () => {
    if (!apiKey) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/setup/test-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      setTestResult(
        data.success
          ? { success: true, message: "API key is valid" }
          : { success: false, message: data.error || "Invalid key" }
      );
    } catch {
      setTestResult({ success: false, message: "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeddings: { apiKey } }),
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
      <StepBadge tone="optional">Optional</StepBadge>

      <h2 className={onboardingHeadingClass}>AI-Powered Intelligence</h2>
      <p className={`${onboardingSubheadingClass} mb-8 mt-4 max-w-[480px]`}>
        Add a Gemini API key to unlock AI features. Free tier available with
        generous limits.
      </p>

      <div className="mb-8 grid w-full max-w-[480px] grid-cols-2 gap-3">
        <div className={`${onboardingPanelClass} text-left`}>
          <div className="mb-1 text-sm font-medium text-[#f2ede5]">
            AI Summaries
          </div>
          <div className={onboardingNoteClass}>
            Auto-generated summaries for every captured item
          </div>
        </div>
        <div className={`${onboardingPanelClass} text-left`}>
          <div className="mb-1 text-sm font-medium text-[#f2ede5]">
            Smart Tags
          </div>
          <div className={onboardingNoteClass}>
            Auto-tagging and intelligent categorization
          </div>
        </div>
        <div className={`${onboardingPanelClass} text-left`}>
          <div className="mb-1 text-sm font-medium text-[#f2ede5]">
            Image Descriptions
          </div>
          <div className={onboardingNoteClass}>
            AI describes images for search and accessibility
          </div>
        </div>
        <div className={`${onboardingPanelClass} text-left`}>
          <div className="mb-1 text-sm font-medium text-[#f2ede5]">
            Semantic Search
          </div>
          <div className={onboardingNoteClass}>
            Find content by meaning, not just keywords
          </div>
        </div>
      </div>

      <div className={`${onboardingPanelClass} mb-6 w-full max-w-[480px] text-left`}>
        <p className={onboardingNoteClass}>
          <strong className="text-[#f2ede5]">Without Gemini:</strong> Capture,
          keyword search, and browsing work perfectly. You just will not have
          AI summaries, smart tags, or semantic search. You can always add a
          key later in Settings.
        </p>
      </div>

      <div className="mb-4 w-full max-w-[480px]">
        <label className={onboardingLabelClass}>Gemini API Key</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setTestResult(null);
            }}
            placeholder="AIza..."
            className={`${onboardingInputClass} flex-1`}
          />
          <button
            onClick={handleTest}
            disabled={!apiKey || testing}
            className={`${onboardingSecondaryButtonClass} h-11 px-4 disabled:cursor-default disabled:opacity-30`}
          >
            {testing ? "Testing..." : "Test"}
          </button>
        </div>

        {testResult && (
          <p
            className={`mt-2 text-left text-xs ${
              testResult.success ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {testResult.message}
          </p>
        )}
      </div>

      <a
        href="https://aistudio.google.com/apikey"
        target="_blank"
        rel="noopener noreferrer"
        className={`${onboardingTextButtonClass} mb-6`}
      >
        Get a free Gemini API key &rarr;
      </a>

      <p className={`${onboardingNoteClass} mb-6 max-w-[400px]`}>
        Your key is stored locally in .env.local. Content is sent to Google&apos;s
        Gemini API only for processing and never stored by them.
      </p>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!apiKey || !testResult?.success || saving}
          className={onboardingPrimaryButtonClass}
        >
          {saving ? "Saving..." : "Save & Continue"}
        </button>
        <button onClick={onContinue} className={onboardingTextButtonClass}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
