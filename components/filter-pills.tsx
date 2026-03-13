"use client";

import { cn } from "@/lib/utils";

interface FilterPillsProps {
  activeType: string;
  onTypeChange: (type: string) => void;
}

const filters = [
  { label: "All", value: "" },
  { label: "Tweets", value: "tweet" },
  { label: "Threads", value: "thread" },
  { label: "Articles", value: "article" },
  { label: "Art", value: "art" },
];

export function FilterPills({ activeType, onTypeChange }: FilterPillsProps) {
  return (
    <div className="flex gap-2 justify-center">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => onTypeChange(f.value)}
          className={cn(
            "px-4 py-1.5 rounded-2xl text-[13px] border transition-all cursor-pointer",
            activeType === f.value
              ? "bg-[#1a1a24] border-[#ffffff24] text-[#f0f0f5]"
              : "bg-[#111118] border-[#ffffff12] text-[#8888aa] hover:border-[#ffffff18]"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
