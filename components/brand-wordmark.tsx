import { cn } from "@/lib/utils";

interface BrandWordmarkProps {
  className?: string;
  dotClassName?: string;
}

export function BrandWordmark({
  className,
  dotClassName,
}: BrandWordmarkProps) {
  return (
    <span
      className={cn(
        "font-heading inline-flex items-center gap-[0.32em] leading-none tracking-normal",
        className
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 44 44"
        className="h-[0.98em] w-[0.98em] shrink-0 translate-y-[0.03em]"
      >
        <rect x="5" y="5" width="34" height="34" rx="11" fill="#111821" stroke="rgba(214,201,178,0.22)" />
        <path d="M15 13v18" stroke="#f2ede5" strokeWidth="5" strokeLinecap="round" />
        <path d="M29 13v18" stroke="#f2ede5" strokeWidth="5" strokeLinecap="round" opacity="0.62" />
        <path d="M29 13c-7.5 0-13.5 5.2-13.5 12.2" stroke="#b89462" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M15.5 25.2l-4-3.8M15.5 25.2l3.9-3.8" stroke="#b89462" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>scroll</span>
      <span
        aria-hidden="true"
        className={cn(
          "ml-[0.14em] mr-[0.08em] inline-block h-[0.34em] w-[0.34em] shrink-0 translate-y-[0.03em] rounded-full bg-[var(--accent-article)]",
          dotClassName
        )}
      />
      <span>back</span>
    </span>
  );
}
