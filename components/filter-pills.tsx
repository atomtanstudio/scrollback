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
    <div className="flex justify-center gap-2">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => onTypeChange(f.value)}
          className={cn(
            "cursor-pointer rounded-full border px-4 py-2 text-[13px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]",
            activeType === f.value
              ? "border-[#d6c9b242] bg-[#f2ede50a] text-[#f2ede5]"
              : "border-[#d6c9b214] bg-[#ffffff05] text-[#a49b8b] hover:border-[#d6c9b233] hover:text-[#f2ede5]"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
