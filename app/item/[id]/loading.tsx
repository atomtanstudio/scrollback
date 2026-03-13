export default function Loading() {
  return (
    <main className="min-h-screen">
      <div className="max-w-[960px] mx-auto px-5 py-6">
        {/* Back nav skeleton */}
        <div className="h-5 w-28 bg-[#1a1a24] rounded animate-pulse mb-6" />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          {/* Content skeleton */}
          <div className="rounded-[16px] bg-[#111118] border border-[rgba(255,255,255,0.07)] p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-[#1a1a24] animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-[#1a1a24] rounded animate-pulse" />
                <div className="h-3 w-24 bg-[#1a1a24] rounded animate-pulse" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 w-full bg-[#1a1a24] rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-[#1a1a24] rounded animate-pulse" />
              <div className="h-4 w-4/6 bg-[#1a1a24] rounded animate-pulse" />
            </div>
            <div className="h-48 w-full bg-[#1a1a24] rounded-xl animate-pulse mt-6" />
          </div>

          {/* Sidebar skeleton */}
          <div className="space-y-5">
            <div className="rounded-[16px] bg-[#111118] border border-[rgba(255,255,255,0.07)] p-5 h-[200px] animate-pulse" />
            <div className="rounded-[14px] bg-[#111118] border border-[rgba(255,255,255,0.07)] p-5 h-[140px] animate-pulse" />
            <div className="rounded-[14px] bg-[#111118] border border-[rgba(255,255,255,0.07)] p-4 h-[100px] animate-pulse" />
          </div>
        </div>
      </div>
    </main>
  );
}
