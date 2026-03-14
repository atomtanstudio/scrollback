"use client";

export function CardSkeleton() {
  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[linear-gradient(180deg,rgba(20,26,34,0.96),rgba(15,20,27,0.98))] p-5 animate-pulse">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-full bg-[#1a2028]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-24 rounded bg-[#1a2028]" />
            <div className="h-3 w-16 rounded bg-[#1a2028]" />
          </div>
        </div>
        <div className="space-y-2 mb-3">
          <div className="h-3.5 w-full rounded bg-[#1a2028]" />
          <div className="h-3.5 w-4/5 rounded bg-[#1a2028]" />
          <div className="h-3.5 w-3/5 rounded bg-[#1a2028]" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-20 rounded bg-[#1a2028]" />
          <div className="h-3 w-4 rounded bg-[#1a2028]" />
        </div>
    </div>
  );
}

export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
