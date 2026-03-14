"use client";

import { useRouter } from "next/navigation";

export function BackNavigation() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d6c9b214] bg-[#ffffff08] px-4 py-2.5 text-sm text-[#a49b8b] transition-colors hover:text-[#f2ede5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back to feed
    </button>
  );
}
