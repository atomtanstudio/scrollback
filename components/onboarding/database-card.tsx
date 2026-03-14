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
        "w-full rounded-[24px] border p-5 text-left transition-all duration-200 cursor-pointer",
        selected
          ? "bg-[#ffffff08]"
          : "border-[#d6c9b214] bg-[#ffffff05] hover:border-[#d6c9b22e]"
      )}
      style={{
        borderColor: selected ? `${accentColor}55` : undefined,
        boxShadow: selected ? `0 20px 56px -34px ${accentColor}` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <h3 className="font-heading text-[1.05rem] font-semibold tracking-[-0.03em] text-[#f2ede5]">
              {title}
            </h3>
          </div>
          <p className="max-w-[48ch] text-sm leading-7 text-[#b4ab9d]">
            {description}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{
            backgroundColor: `${accentColor}12`,
            borderColor: `${accentColor}24`,
            color: accentColor,
          }}
        >
          {badge}
        </span>
      </div>
    </button>
  );
}
