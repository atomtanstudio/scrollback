"use client";

export function CardSkeleton() {
  return (
    <div className="rounded-[14px] p-px bg-[#ffffff08]">
      <div className="rounded-[13px] bg-[#111118] p-5 animate-pulse">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-full bg-[#1a1a24]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-24 bg-[#1a1a24] rounded" />
            <div className="h-3 w-16 bg-[#1a1a24] rounded" />
          </div>
        </div>
        <div className="space-y-2 mb-3">
          <div className="h-3.5 w-full bg-[#1a1a24] rounded" />
          <div className="h-3.5 w-4/5 bg-[#1a1a24] rounded" />
          <div className="h-3.5 w-3/5 bg-[#1a1a24] rounded" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-20 bg-[#1a1a24] rounded" />
          <div className="h-3 w-4 bg-[#1a1a24] rounded" />
        </div>
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
