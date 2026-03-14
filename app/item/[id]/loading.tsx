export default function Loading() {
  return (
    <main className="min-h-screen">
      <div className="max-w-[960px] mx-auto px-5 py-6">
        <div className="mb-6 h-5 w-28 rounded bg-[#1a2028] animate-pulse" />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          <div className="rounded-[24px] border border-[#d6c9b214] bg-[linear-gradient(180deg,rgba(20,26,34,0.96),rgba(15,20,27,0.98))] p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-full bg-[#1a2028] animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-[#1a2028] animate-pulse" />
                <div className="h-3 w-24 rounded bg-[#1a2028] animate-pulse" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 w-full rounded bg-[#1a2028] animate-pulse" />
              <div className="h-4 w-5/6 rounded bg-[#1a2028] animate-pulse" />
              <div className="h-4 w-4/6 rounded bg-[#1a2028] animate-pulse" />
            </div>
            <div className="mt-6 h-48 w-full rounded-xl bg-[#1a2028] animate-pulse" />
          </div>

          <div className="space-y-5">
            <div className="h-[200px] rounded-[24px] border border-[#d6c9b214] bg-[linear-gradient(180deg,rgba(20,26,34,0.96),rgba(15,20,27,0.98))] animate-pulse p-5" />
            <div className="h-[140px] rounded-[22px] border border-[#d6c9b214] bg-[linear-gradient(180deg,rgba(20,26,34,0.96),rgba(15,20,27,0.98))] animate-pulse p-5" />
            <div className="h-[100px] rounded-[22px] border border-[#d6c9b214] bg-[linear-gradient(180deg,rgba(20,26,34,0.96),rgba(15,20,27,0.98))] animate-pulse p-4" />
          </div>
        </div>
      </div>
    </main>
  );
}
