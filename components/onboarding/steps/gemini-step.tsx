"use client";

import { useState } from "react";

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
      onContinue(); // Non-fatal, continue anyway
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
        AI-Powered Intelligence
      </h2>
      <p className="text-[hsl(var(--muted-foreground))] text-sm mb-8 max-w-[480px]">
        Add a Gemini API key to unlock AI features. Free tier available with generous limits.
      </p>

      {/* Feature cards */}
      <div className="grid grid-cols-2 gap-3 mb-8 w-full max-w-[480px]">
        <div className="rounded-[10px] bg-[#111118] border border-[#ffffff0a] p-3 text-left">
          <div className="text-sm font-medium text-[#f0f0f5] mb-1">AI Summaries</div>
          <div className="text-xs text-[#8888aa]">
            Auto-generated summaries for every captured item
          </div>
        </div>
        <div className="rounded-[10px] bg-[#111118] border border-[#ffffff0a] p-3 text-left">
          <div className="text-sm font-medium text-[#f0f0f5] mb-1">Smart Tags</div>
          <div className="text-xs text-[#8888aa]">
            Auto-tagging and intelligent categorization
          </div>
        </div>
        <div className="rounded-[10px] bg-[#111118] border border-[#ffffff0a] p-3 text-left">
          <div className="text-sm font-medium text-[#f0f0f5] mb-1">Image Descriptions</div>
          <div className="text-xs text-[#8888aa]">
            AI describes images for search and accessibility
          </div>
        </div>
        <div className="rounded-[10px] bg-[#111118] border border-[#ffffff0a] p-3 text-left">
          <div className="text-sm font-medium text-[#f0f0f5] mb-1">Semantic Search</div>
          <div className="text-xs text-[#8888aa]">
            Find content by meaning, not just keywords
          </div>
        </div>
      </div>

      {/* Without Gemini note */}
      <div className="rounded-[10px] bg-[#1a1a24] border border-[#ffffff0a] p-4 mb-6 w-full max-w-[480px] text-left">
        <p className="text-xs text-[#8888aa] leading-relaxed">
          <strong className="text-[#f0f0f5]">Without Gemini:</strong> Capture, keyword search,
          and browsing work perfectly. You just won&apos;t have AI summaries, smart tags, or semantic search.
          You can always add a key later in Settings.
        </p>
      </div>

      {/* API key input */}
      <div className="w-full max-w-[480px] mb-4">
        <label className="text-[13px] font-medium text-[#f0f0f5] mb-2 block text-left">
          Gemini API Key
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setTestResult(null);
            }}
            placeholder="AIza..."
            className="flex-1 h-10 px-4 rounded-[10px] bg-[#0a0a0f] border border-[#ffffff12] text-[#f0f0f5] text-sm placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-[#ffffff30] transition-colors"
          />
          <button
            onClick={handleTest}
            disabled={!apiKey || testing}
            className="h-10 px-4 rounded-[10px] text-sm font-medium bg-[#1a1a24] text-[#f0f0f5] border border-[#ffffff12] hover:border-[#ffffff24] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
          >
            {testing ? "Testing..." : "Test"}
          </button>
        </div>

        {/* Test result */}
        {testResult && (
          <p
            className={`text-xs mt-2 text-left ${
              testResult.success ? "text-[#00ffc8]" : "text-[#ff4444]"
            }`}
          >
            {testResult.message}
          </p>
        )}
      </div>

      {/* Get key link */}
      <a
        href="https://aistudio.google.com/apikey"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-[var(--accent-thread)] hover:underline mb-6"
      >
        Get a free Gemini API key &rarr;
      </a>

      {/* Privacy note */}
      <p className="text-xs text-[#8888aa] mb-6 max-w-[400px]">
        Your key is stored locally in .env.local. Content is sent to Google&apos;s
        Gemini API only for processing — never stored by them.
      </p>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!apiKey || !testResult?.success || saving}
          className="h-12 px-8 rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold text-[15px] hover:brightness-110 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-default"
        >
          {saving ? "Saving..." : "Save & Continue"}
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
