"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onClear: () => void;
}

export function SearchBar({ onSearch, onClear }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isMacLike, setIsMacLike] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const hotkeyLabel = isMacLike ? "⌘K" : "Ctrl K";

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      userAgentData?: { platform?: string };
    };
    const platform =
      nav.userAgentData?.platform || navigator.platform || navigator.userAgent;
    setIsMacLike(/mac|iphone|ipad|ipod/i.test(platform));
  }, []);

  // Debounced live search as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        onSearch(query.trim());
      }, 300);
    } else if (query.trim().length === 0) {
      onClear();
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, onSearch, onClear]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (query.trim()) {
        onSearch(query.trim());
      } else {
        onClear();
      }
    },
    [query, onSearch, onClear]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    onClear();
  }, [onClear]);

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[640px]">
      <div className="rounded-[20px] border border-[#d6c9b233] bg-[linear-gradient(180deg,rgba(244,234,216,0.05),rgba(244,234,216,0.015))] p-[1px] shadow-[0_18px_42px_rgba(0,0,0,0.22)] transition-colors duration-300 hover:border-[#d6c9b24d] focus-within:border-[#d6c9b266]">
        <div className="flex h-14 w-full items-center gap-3 rounded-[19px] bg-[#171b22]/95 px-4 sm:h-16 sm:px-5">
          <svg className="shrink-0 text-[#8a8174]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your captures..."
            className="flex-1 border-none bg-transparent font-sans text-base text-[#f2ede5] outline-none placeholder:text-[#7d7569]"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="cursor-pointer text-[#8a8174] transition-colors hover:text-[#f2ede5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
              aria-label="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          <span className="hidden rounded-full border border-[#d6c9b21f] bg-[#0f1319] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[#8a8174] md:inline-flex">
            {hotkeyLabel}
          </span>
        </div>
      </div>
    </form>
  );
}
