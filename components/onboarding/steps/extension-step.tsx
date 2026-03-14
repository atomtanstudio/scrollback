"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { TokenDisplay } from "@/components/shared/token-display";
import {
  onboardingHeadingClass,
  onboardingPrimaryButtonClass,
  onboardingSubheadingClass,
  onboardingTextButtonClass,
  StepBadge,
} from "../ui";

export function ExtensionStep() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const generated = uuidv4();
    setToken(generated);
  }, []);

  const handleFinish = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extension: { pairingToken: token },
        }),
      });
    } catch {
      // Non-fatal.
    }

    try {
      const confetti = (await import("canvas-confetti")).default;
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#6e98a0", "#8c7f9f", "#b89462", "#b66f78"],
      });
    } catch {
      // Non-fatal.
    }

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
      <StepBadge>Final step</StepBadge>
      <h2 className={onboardingHeadingClass}>Connect the browser extension</h2>
      <p className={`${onboardingSubheadingClass} mb-8 mt-4 max-w-[480px]`}>
        The FeedSilo browser extension captures tweets, threads, and articles
        with one click. Copy this token and paste it in the extension settings.
      </p>

      {token && (
        <div className="mb-6 w-full">
          <label className="mb-2 block text-left text-[13px] font-medium text-[#e7e0d5]">
            Pairing token
          </label>
          <TokenDisplay token={token} />
        </div>
      )}

      <div className="flex w-full flex-col items-center gap-3">
        <button
          onClick={handleFinish}
          disabled={saving}
          className={onboardingPrimaryButtonClass}
        >
          {saving ? "Finishing..." : "Open FeedSilo"}
        </button>

        <button onClick={handleSkip} className={onboardingTextButtonClass}>
          I&apos;ll do this later
        </button>
      </div>
    </div>
  );
}
