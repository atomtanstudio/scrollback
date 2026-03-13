"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { TokenDisplay } from "@/components/shared/token-display";

export function ExtensionStep() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  // Generate pairing token on mount
  useEffect(() => {
    const generated = uuidv4();
    setToken(generated);
  }, []);

  const handleFinish = useCallback(async () => {
    setSaving(true);
    try {
      // Save the pairing token to config
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extension: { pairingToken: token },
        }),
      });
    } catch {
      // Non-fatal — token can be configured later
    }

    // Fire confetti
    try {
      const confetti = (await import("canvas-confetti")).default;
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#22d3ee", "#a78bfa", "#fb923c", "#ec4899"],
      });
    } catch {
      // Non-fatal
    }

    // Clear onboarding state and redirect
    sessionStorage.removeItem("feedsilo-onboarding-step");
    sessionStorage.removeItem("feedsilo-onboarding-db");

    setTimeout(() => {
      router.push("/");
    }, 1500);
  }, [token, router]);

  const handleSkip = useCallback(() => {
    sessionStorage.removeItem("feedsilo-onboarding-step");
    sessionStorage.removeItem("feedsilo-onboarding-db");
    router.push("/");
  }, [router]);

  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="font-heading font-extrabold text-2xl md:text-3xl tracking-tight text-[#f0f0f5] mb-2">
        Connect the browser extension
      </h2>
      <p className="text-[hsl(var(--muted-foreground))] text-sm mb-8 max-w-[480px]">
        The FeedSilo browser extension captures tweets, threads, and articles
        with one click. Copy this token and paste it in the extension settings.
      </p>

      {token && (
        <div className="w-full mb-6">
          <label className="text-[13px] font-medium text-[#f0f0f5] mb-2 block text-left">
            Pairing token
          </label>
          <TokenDisplay token={token} />
        </div>
      )}

      <div className="flex flex-col items-center gap-3 w-full">
        <button
          onClick={handleFinish}
          disabled={saving}
          className="h-12 px-8 rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold text-[15px] hover:brightness-110 transition-all duration-200 cursor-pointer disabled:opacity-30"
        >
          {saving ? "Finishing..." : "Open FeedSilo"}
        </button>

        <button
          onClick={handleSkip}
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[#f0f0f5] transition-colors cursor-pointer"
        >
          I&apos;ll do this later
        </button>
      </div>
    </div>
  );
}
