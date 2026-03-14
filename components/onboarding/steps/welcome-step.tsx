"use client";

import { cn } from "@/lib/utils";
import { BrandWordmark } from "@/components/brand-wordmark";
import {
  onboardingHeadingClass,
  onboardingNoteClass,
  onboardingPanelClass,
  onboardingPrimaryButtonClass,
  onboardingSubheadingClass,
} from "../ui";

interface WelcomeStepProps {
  onContinue: () => void;
}

export function WelcomeStep({ onContinue }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <BrandWordmark className="mb-4 text-[32px] font-semibold tracking-tight text-[#f2ede5]" />

      <h1 className={cn(onboardingHeadingClass, "max-w-[12ch]")}>
        Your personal content
        <br />
        intelligence feed
      </h1>

      <p
        className={cn(
          onboardingSubheadingClass,
          "mb-10 mt-4 max-w-[480px] text-base"
        )}
      >
        Capture tweets, threads, and articles from your browser. Search,
        organize, and rediscover what matters.
      </p>

      <div className="mb-8 flex w-full max-w-[400px] flex-col gap-4 text-left">
        <div className="flex items-start gap-3">
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--accent-tweet)]" />
          <span className="text-[#f2ede5]">
            <strong>Capture</strong> - Save tweets, threads, and articles with
            one click
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--accent-thread)]" />
          <span className="text-[#f2ede5]">
            <strong>Search</strong> - Full-text and semantic search across
            everything
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--accent-article)]" />
          <span className="text-[#f2ede5]">
            <strong>Own your data</strong> - Self-hosted, open source, MIT
            licensed
          </span>
        </div>
      </div>

      <div
        className={cn(
          onboardingPanelClass,
          "mb-10 w-full max-w-[440px] text-left"
        )}
      >
        <div className="mb-3 flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="shrink-0"
          >
            <path
              d="M8 1L2 4v4c0 3.5 2.6 6.4 6 7 3.4-.6 6-3.5 6-7V4L8 1z"
              stroke="#b89462"
              strokeWidth="1.2"
              fill="none"
            />
            <path
              d="M6 8l1.5 1.5L10.5 6"
              stroke="#b89462"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-sm font-medium text-[#f2ede5]">
            Your privacy is guaranteed
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <p className={onboardingNoteClass}>
            100% self-hosted - all data stays on your machine. No cloud
            accounts, no telemetry, no tracking.
          </p>
          <p className={onboardingNoteClass}>
            API keys are stored locally and never transmitted to us. We do not
            store your data anywhere.
          </p>
        </div>
      </div>

      <button onClick={onContinue} className={onboardingPrimaryButtonClass}>
        Get Started
      </button>

      <p className="mt-6 text-xs text-[#7d7569]">
        Open source &middot; MIT licensed &middot; zero data collection
      </p>
    </div>
  );
}
