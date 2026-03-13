"use client";

import { cn } from "@/lib/utils";

export type DatabaseChoice = "sqlite" | "postgresql" | "supabase";

interface DatabaseCardProps {
  type: DatabaseChoice;
  title: string;
  description: string;
  badge: string;
  accentColor: string;
  selected: boolean;
  onSelect: () => void;
}

export function DatabaseCard({
  title,
  description,
  badge,
  accentColor,
  selected,
  onSelect,
}: DatabaseCardProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-[14px] p-px transition-all duration-200 cursor-pointer",
        selected
          ? "shadow-[0_0_20px_-4px_var(--glow)]"
          : "opacity-60 hover:opacity-80"
      )}
      style={{
        background: selected
          ? `linear-gradient(135deg, ${accentColor}40, ${accentColor}15, transparent)`
          : "hsl(var(--border))",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ["--glow" as any]: accentColor,
      }}
    >
      <div
        className={cn(
          "rounded-[13px] p-5 transition-all duration-200",
          selected ? "bg-[#111118]" : "bg-[#0e1018]"
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5]">
            {title}
          </h3>
          <span
            className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
            style={{
              backgroundColor: `${accentColor}18`,
              color: accentColor,
            }}
          >
            {badge}
          </span>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {description}
        </p>
      </div>
    </button>
  );
}
