"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onClear: () => void;
}

export function SearchBar({ onSearch, onClear }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[#555566] hover:text-[#8888aa] transition-colors cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          <span className="text-xs text-[#555566] bg-[#0a0a0f] px-2 py-1 rounded-md border border-[#ffffff12]">
            &#8984;K
          </span>
        </div>
      </div>
    </form>
  );
}
