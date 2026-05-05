"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OnboardingLayoutProps {
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  children: ReactNode;
}

export function OnboardingLayout({
  currentStep,
  totalSteps,
  onBack,
  children,
}: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[760px]">
        <div className="overflow-hidden rounded-[28px] border border-[#d6c9b21a] bg-[linear-gradient(180deg,rgba(24,29,37,0.96),rgba(14,18,24,0.98))] shadow-[0_34px_90px_rgba(2,6,12,0.45)]">
          <div className="border-b border-[#d6c9b214] px-6 py-5 sm:px-8 sm:py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#a49b8b]">
                  Scrollback setup
                </p>
                <p className="mt-2 text-sm text-[#cdc4b7]">
                  Step {currentStep} of {totalSteps}
                </p>
              </div>
              {onBack && currentStep > 1 && (
                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-2 rounded-full border border-[#d6c9b21a] bg-[#ffffff05] px-4 py-2 text-sm text-[#a49b8b] transition-colors hover:border-[#d6c9b233] hover:text-[#f2ede5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}
            </div>

            <div className="mt-5 grid grid-cols-7 gap-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    i + 1 === currentStep
                      ? "bg-[#b89462]"
                      : i + 1 < currentStep
                        ? "bg-[#8c7f9f]"
                        : "bg-[#ffffff12]"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8 sm:py-10">{children}</div>
        </div>
      </div>
    </div>
  );
}
