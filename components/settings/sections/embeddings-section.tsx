"use client";

import { useState } from "react";
import { ProgressBar } from "@/components/shared/progress-bar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface EmbeddingsSectionProps { settings: any; onRefresh: () => void }

export function EmbeddingsSection({ settings, onRefresh }: EmbeddingsSectionProps) {
  const [provider, setProvider] = useState<"openai-codex" | "openai" | "gemini">(
    settings?.embeddings?.provider === "openai-codex"
      ? "openai-codex"
      : settings?.embeddings?.provider === "openai"
        ? "openai"
        : "gemini"
  );
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const hasKey = settings?.embeddings?.hasKey;

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
      const data = await res.json().catch(() => ({}));
      setTestResult(
        res.ok && data.success
          ? { success: true, message: `${provider === "openai-codex" ? "Codex" : provider === "openai" ? "OpenAI" : "Gemini"} connection is valid` }
          : { success: false, message: data.error || "Connection failed" }
      );
    } catch {
      setTestResult({ success: false, message: "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (provider !== "openai-codex" && !apiKey) return;
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeddings: { provider, apiKey: provider === "openai-codex" ? undefined : apiKey } }),
      });
      setApiKey("");
      onRefresh();
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05] p-6">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#d6c9b214] bg-[#0f141b]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-thread)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h3 className="font-heading text-[15px] font-semibold text-[#f2ede5]">
              AI Provider
            </h3>
            <p className="text-xs text-[#a49b8b]">
              {settings?.embeddings?.provider === "openai-codex" ? "OpenAI Codex" : settings?.embeddings?.provider === "openai" ? "OpenAI" : "Gemini"} for summaries, tags, image descriptions, semantic search
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          hasKey
            ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
            : "border border-[#d6c9b214] bg-[#ffffff08] text-[#a49b8b]"
        }`}>
          {hasKey ? "Active" : "Not configured"}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#8a8174]">Provider</label>
          <div className="grid grid-cols-2 gap-2">
            {(["openai-codex", "openai", "gemini"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setProvider(option);
                  setApiKey("");
                  setTestResult(null);
                }}
                className={`h-10 rounded-[12px] border text-xs font-medium transition-colors ${
                  provider === option
                    ? "border-[var(--accent-article)] bg-[#b894621f] text-[#f2ede5]"
                    : "border-[#d6c9b214] bg-[#ffffff05] text-[#a49b8b] hover:border-[#d6c9b233]"
                }`}
              >
                {option === "openai-codex" ? "Codex" : option === "openai" ? "OpenAI" : "Gemini"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
              <label className="text-xs text-[#8a8174]">API Key</label>
              {hasKey && (
                <span className="text-xs text-emerald-300">configured</span>
              )}
          </div>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? "••••••••" : provider === "openai-codex" ? "Uses local Codex login" : provider === "openai" ? "sk-..." : "AIza..."}
              disabled={provider === "openai-codex"}
              className="flex-1 h-10 rounded-[12px] border border-[#d6c9b214] bg-[#0f141b] px-4 text-sm text-[#f2ede5] placeholder:text-[#6f695f] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              disabled={provider === "openai-codex"}
              className="h-10 rounded-[12px] border border-[#d6c9b214] px-3 text-xs text-[#a49b8b] transition-colors cursor-pointer hover:border-[#d6c9b233]"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-[#8a8174]">
              Embeddings: <code className="text-[var(--accent-tweet)]">{provider === "openai-codex" ? "not supported" : provider === "openai" ? "text-embedding-3-small" : "gemini-embedding-001"}</code>
            </p>
            {provider !== "openai-codex" && (
              <a
                href={provider === "openai" ? "https://platform.openai.com/api-keys" : "https://aistudio.google.com/apikey"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[var(--accent-article)] hover:underline"
              >
                {provider === "openai" ? "Create key" : "Get a free key"} &rarr;
              </a>
            )}
          </div>
        </div>

        {(apiKey || provider === "openai-codex") && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTest}
              disabled={(provider !== "openai-codex" && !apiKey) || testing}
              className="h-9 rounded-[12px] border border-[#d6c9b214] bg-[#ffffff05] px-4 text-sm font-medium text-[#f2ede5] transition-all duration-200 cursor-pointer hover:border-[#d6c9b233] disabled:cursor-default disabled:opacity-40"
            >
              {testing ? "Testing..." : "Test"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !testResult?.success}
              className="h-9 rounded-[12px] bg-[var(--accent-article)] px-4 text-sm font-medium text-[#090c11] transition-all duration-200 cursor-pointer hover:brightness-110 disabled:cursor-default disabled:opacity-50"
            >
              {saving ? "Saving..." : provider === "openai-codex" ? "Save Provider" : "Save API Key"}
            </button>
            {testResult && (
              <span className={`text-xs ${testResult.success ? "text-emerald-300" : "text-red-300"}`}>
                {testResult.message}
              </span>
            )}
          </div>
        )}

        <div className="border-t border-[#d6c9b214] pt-4">
          <h4 className="mb-2 text-sm font-medium text-[#f2ede5]">Generate Missing Embeddings</h4>
          <p className="mb-3 text-xs text-[#a49b8b]">
            Generate vector embeddings for items that don&apos;t have them yet. Requires an API key.
          </p>
          <ProgressBar
            endpoint="/api/embeddings/generate-missing"
            buttonLabel="Generate Embeddings"
          />
        </div>

        <div className="border-t border-[#d6c9b214] pt-4">
          <h4 className="mb-2 text-sm font-medium text-[#f2ede5]">Reclassify All Items</h4>
          <p className="mb-3 text-xs text-[#a49b8b]">
            Clear old tags and re-run AI classification on all items. Use after improving classification prompts. Processes up to 50 items per run — run multiple times for larger libraries.
          </p>
          <ProgressBar
            endpoint="/api/backfill/classify?scope=reclassify"
            buttonLabel="Reclassify Items"
          />
        </div>

        <div className="border-t border-[#d6c9b214] pt-4">
          <h4 className="mb-2 text-sm font-medium text-[#f2ede5]">Re-translate Foreign Language Items</h4>
          <p className="mb-3 text-xs text-[#a49b8b]">
            Re-translate non-English items that have missing or incomplete translations. Useful after updating translation limits.
          </p>
          <ProgressBar
            endpoint="/api/backfill/classify?scope=translate"
            buttonLabel="Re-translate Items"
          />
        </div>
      </div>
    </div>
  );
}
