import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const onboardingPanelClass =
  "rounded-[24px] border border-[#d6c9b214] bg-[#ffffff08] p-4 sm:p-5";

export const onboardingInputClass =
  "w-full h-11 rounded-[16px] border border-[#d6c9b21f] bg-[#0f141b] px-4 text-sm text-[#f2ede5] placeholder:text-[#7d7569] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462] focus-visible:ring-offset-0";

export const onboardingPrimaryButtonClass =
  "inline-flex h-12 items-center justify-center rounded-[16px] border border-[#cfb28a55] bg-[#b89462] px-8 font-heading text-[15px] font-semibold text-[#10141a] shadow-[0_16px_40px_rgba(184,148,98,0.24)] transition-all duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8c0a0] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:brightness-100";

export const onboardingSecondaryButtonClass =
  "inline-flex h-11 items-center justify-center rounded-[14px] border border-[#d6c9b21a] bg-[#ffffff05] px-5 text-sm font-medium text-[#cdc4b7] transition-colors hover:border-[#d6c9b236] hover:text-[#f2ede5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]";

export const onboardingTextButtonClass =
  "rounded-md text-sm text-[#9c9387] transition-colors hover:text-[#f2ede5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]";

export const onboardingHeadingClass =
  "font-heading text-[clamp(2rem,3vw,2.9rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-[#f2ede5]";

export const onboardingSubheadingClass =
  "text-[15px] leading-7 text-[#b4ab9d]";

export const onboardingLabelClass =
  "mb-2 block text-left text-[13px] font-medium text-[#e7e0d5]";

export const onboardingNoteClass = "text-xs leading-relaxed text-[#9c9387]";

interface StepBadgeProps {
  children: ReactNode;
  tone?: "neutral" | "optional" | "recommended";
  className?: string;
}

const badgeToneClasses: Record<NonNullable<StepBadgeProps["tone"]>, string> = {
  neutral: "border-[#d6c9b21f] bg-[#ffffff06] text-[#cdc4b7]",
  optional:
    "border-[rgba(140,127,159,0.36)] bg-[rgba(140,127,159,0.12)] text-[#c7bad6]",
  recommended:
    "border-[rgba(184,148,98,0.36)] bg-[rgba(184,148,98,0.14)] text-[#e0c29c]",
};

export function StepBadge({
  children,
  tone = "neutral",
  className,
}: StepBadgeProps) {
  return (
    <span
      className={cn(
        "mb-4 inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        badgeToneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
