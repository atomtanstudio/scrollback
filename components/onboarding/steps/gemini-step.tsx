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
  const [provider, setProvider] = useState<"openai-codex" | "openai" | "gemini">("openai-codex");
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [saveError, setSaveError] = useState("");

  const handleTest = async () => {
    if (provider !== "openai-codex" && !apiKey) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/setup/test-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data = await res.json();
      setTestResult(
        data.success
          ? { success: true, message: `${provider === "openai-codex" ? "OpenAI Codex" : provider === "openai" ? "OpenAI" : "Gemini"} connection is valid` }
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
    setSaveError("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeddings: { provider, apiKey: provider === "openai-codex" ? undefined : apiKey } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save API key");
      }
      onContinue();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save API key");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <StepBadge tone="optional">Optional</StepBadge>

      <h2 className={onboardingHeadingClass}>AI-Powered Intelligence</h2>
      <p className={`${onboardingSubheadingClass} mb-8 mt-4 max-w-[480px]`}>
        Connect an AI provider to unlock summaries, smart tags, translations,
        image descriptions, and semantic search.
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
          <strong className="text-[#f2ede5]">Without an AI provider:</strong> Capture,
          keyword search, and browsing work perfectly. You just will not have
          AI summaries, smart tags, or semantic search. You can always add a
          key later in Settings.
        </p>
      </div>

      <div className="mb-4 w-full max-w-[480px]">
        <label className={onboardingLabelClass}>AI Provider</label>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {(["openai-codex", "openai", "gemini"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setProvider(option);
                setApiKey("");
                setTestResult(null);
                setSaveError("");
              }}
              className={`h-11 rounded-[12px] border text-sm font-medium transition-colors ${
                provider === option
                  ? "border-[#b89462] bg-[#b894621f] text-[#f2ede5]"
                  : "border-[#d6c9b214] bg-[#ffffff05] text-[#a49b8b] hover:border-[#d6c9b233]"
              }`}
            >
              {option === "openai-codex" ? "Codex" : option === "openai" ? "OpenAI" : "Gemini"}
            </button>
          ))}
        </div>
        {provider === "openai-codex" ? (
          <p className={`${onboardingNoteClass} mb-3 text-left`}>
            Uses your local Codex/ChatGPT login from <code>~/.codex/auth.json</code>.
            No API key is needed. Semantic embeddings are not available with this provider.
          </p>
        ) : (
          <label className={onboardingLabelClass}>
            {provider === "openai" ? "OpenAI API Key" : "Gemini API Key"}
          </label>
        )}
        <div className="flex gap-2">
          {provider !== "openai-codex" && (
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
                setSaveError("");
              }}
              placeholder={provider === "openai" ? "sk-..." : "AIza..."}
              className={`${onboardingInputClass} flex-1`}
            />
          )}
          <button
            onClick={handleTest}
            disabled={(provider !== "openai-codex" && !apiKey) || testing}
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
        {saveError && (
          <p className="mt-2 text-left text-xs text-red-300">{saveError}</p>
        )}
      </div>

      {provider !== "openai-codex" && (
        <a
          href={provider === "openai" ? "https://platform.openai.com/api-keys" : "https://aistudio.google.com/apikey"}
          target="_blank"
          rel="noopener noreferrer"
          className={`${onboardingTextButtonClass} mb-6`}
        >
          {provider === "openai" ? "Create an OpenAI API key" : "Get a free Gemini API key"} &rarr;
        </a>
      )}

      <p className={`${onboardingNoteClass} mb-6 max-w-[400px]`}>
        Your key is stored locally in .env.local. Content is sent to the selected
        provider only for processing.
      </p>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleSave}
          disabled={(provider !== "openai-codex" && !apiKey) || !testResult?.success || saving}
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
