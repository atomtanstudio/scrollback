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
        "font-heading inline-flex items-center leading-none tracking-[-0.05em]",
        className
      )}
    >
      <span>feed</span>
      <span
        aria-hidden="true"
        className={cn(
          "ml-[0.14em] mr-[0.08em] inline-block h-[0.34em] w-[0.34em] shrink-0 translate-y-[0.03em] rounded-full bg-[var(--accent-article)]",
          dotClassName
        )}
      />
      <span>silo</span>
    </span>
  );
}
