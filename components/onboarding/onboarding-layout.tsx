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
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-10">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              i + 1 === currentStep
                ? "bg-[var(--accent-thread)] w-6"
                : i + 1 < currentStep
                  ? "bg-[var(--accent-thread)] opacity-60"
                  : "bg-[hsl(var(--muted))]"
            )}
          />
        ))}
      </div>

      {/* Content container */}
      <div className="w-full max-w-[640px] relative">
        {/* Back button */}
        {onBack && currentStep > 1 && (
          <button
            onClick={onBack}
            className="absolute -top-8 left-0 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex items-center gap-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}

        {children}
      </div>
    </div>
  );
}
