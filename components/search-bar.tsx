"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        router.push(`/?q=${encodeURIComponent(query.trim())}`);
      } else {
        router.push("/");
      }
    },
    [query, router]
  );

  return (
    <form onSubmit={handleSearch} className="w-full max-w-[640px]">
      <div className="p-px rounded-[14px] search-border-gradient opacity-50 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300">
        <div className="flex items-center bg-[#1a1a24] rounded-[13px] h-14 px-5 gap-3 w-full">
          <svg className="text-[#555566] flex-shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your captures..."
            className="flex-1 bg-transparent border-none outline-none text-[#f0f0f5] font-sans text-base placeholder:text-[#555566]"
          />
          <span className="text-xs text-[#555566] bg-[#0a0a0f] px-2 py-1 rounded-md border border-[#ffffff12]">
            &#8984;K
          </span>
        </div>
      </div>
    </form>
  );
}
