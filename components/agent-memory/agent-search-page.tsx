"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Database, ExternalLink, Loader2, Search } from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SearchMode = "keyword" | "vector" | "hybrid";
type Dimensions = 768 | 1536;

type AgentSearchResult = {
  chunk_id: string;
  content_item_id: string;
  title: string;
  chunk_text: string;
  source_url: string | null;
  author_handle: string | null;
  author_display_name: string | null;
  source_type: string;
  posted_at: string | null;
  score: number;
  keyword_score?: number;
  vector_score?: number;
};

type AgentSearchResponse = {
  results: AgentSearchResult[];
  query: string;
  mode: SearchMode;
  dimensions: Dimensions;
  limit: number;
};

interface AgentSearchPageProps {
  isAuthed: boolean;
  isAdmin: boolean;
}

function scoreLabel(score: number): string {
  if (!Number.isFinite(score)) return "0.000";
  return score.toFixed(3);
}

function sourceLabel(result: AgentSearchResult): string {
  return [
    result.source_type.replace(/_/g, " "),
    result.author_handle ? `@${result.author_handle.replace(/^@/, "")}` : result.author_display_name,
  ]
    .filter(Boolean)
    .join(" / ");
}

export function AgentSearchPage({ isAuthed, isAdmin }: AgentSearchPageProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("hybrid");
  const [dimensions, setDimensions] = useState<Dimensions>(768);
  const [limit, setLimit] = useState("20");
  const [response, setResponse] = useState<AgentSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasResults = (response?.results.length || 0) > 0;
  const resultCount = response?.results.length || 0;
  const trimmedQuery = query.trim();
  const parsedLimit = useMemo(() => {
    const value = parseInt(limit, 10);
    if (Number.isNaN(value)) return 20;
    return Math.min(200, Math.max(1, value));
  }, [limit]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedQuery) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/agent/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmedQuery,
          mode,
          dimensions,
          limit: parsedLimit,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Search failed");
      }
      setResponse(payload);
    } catch (err) {
      setResponse(null);
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-12 sm:px-6 lg:px-8">
      <Header isAuthed={isAuthed} isAdmin={isAdmin} currentPath="/agent-search" />

      <section className="grid gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          <div className="mb-5 flex items-center gap-3 text-[#f2ede5]">
            <Database className="h-6 w-6 text-[#b89462]" />
            <h1 className="font-heading text-3xl font-semibold tracking-normal sm:text-4xl">
              Agent Search
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex min-h-14 items-center gap-3 rounded-lg border border-[#d6c9b22b] bg-[#11161d] px-4 shadow-[0_18px_42px_rgba(0,0,0,0.18)] focus-within:border-[#b89462]">
              <Search className="h-5 w-5 shrink-0 text-[#8a8174]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search captured knowledge"
                className="min-w-0 flex-1 bg-transparent py-4 text-base text-[#f2ede5] outline-none placeholder:text-[#7d7569]"
              />
              <Button
                type="submit"
                size="sm"
                className="bg-[#d8b16f] text-[#15130f] hover:bg-[#e7c27f]"
                disabled={!trimmedQuery || loading}
              >
                {loading ? <Loader2 className="animate-spin" /> : <Search />}
                <span className="hidden sm:inline">Search</span>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Select value={mode} onValueChange={(value) => setMode(value as SearchMode)}>
                <SelectTrigger className="border-[#d6c9b22b] bg-[#11161d] text-[#f2ede5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="keyword">Keyword</SelectItem>
                  <SelectItem value="vector">Vector</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={String(dimensions)}
                onValueChange={(value) => setDimensions(Number(value) as Dimensions)}
              >
                <SelectTrigger className="border-[#d6c9b22b] bg-[#11161d] text-[#f2ede5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="768">768</SelectItem>
                  <SelectItem value="1536">1536</SelectItem>
                </SelectContent>
              </Select>
              <input
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                inputMode="numeric"
                className="h-9 rounded-md border border-[#d6c9b22b] bg-[#11161d] px-3 text-sm text-[#f2ede5] outline-none focus:border-[#b89462]"
                aria-label="Result limit"
              />
            </div>
          </form>

          {error && (
            <div className="mt-6 rounded-lg border border-[#b85f5f66] bg-[#381a1a66] px-4 py-3 text-sm text-[#ffd7d7]">
              {error}
            </div>
          )}

          <div className="mt-8 space-y-3">
            {response && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d6c9b21a] pb-3 text-sm text-[#a49b8b]">
                <span>{resultCount.toLocaleString()} results</span>
                <span>
                  {response.mode} / {response.dimensions}
                </span>
              </div>
            )}

            {hasResults &&
              response?.results.map((result) => (
                <article
                  key={result.chunk_id}
                  className="rounded-lg border border-[#d6c9b21f] bg-[#ffffff08] p-4"
                >
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/item/${result.content_item_id}`}
                        className="line-clamp-2 font-heading text-lg font-semibold tracking-normal text-[#f2ede5] transition-colors hover:text-[#e7c27f]"
                      >
                        {result.title}
                      </Link>
                      <div className="mt-1 text-xs uppercase text-[#8a8174]">
                        {sourceLabel(result)}
                      </div>
                    </div>
                    <div className="rounded-md border border-[#d6c9b21f] px-2 py-1 text-xs text-[#d6c9b2]">
                      {scoreLabel(result.score)}
                    </div>
                  </div>
                  <p className="line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-[#c7beb0]">
                    {result.chunk_text}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {result.source_url && (
                      <a
                        href={result.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-[#d6c9b21f] px-2.5 py-1.5 text-xs text-[#a49b8b] transition-colors hover:text-[#f2ede5]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Source
                      </a>
                    )}
                    <Link
                      href={`/item/${result.content_item_id}`}
                      className="inline-flex items-center rounded-md border border-[#d6c9b21f] px-2.5 py-1.5 text-xs text-[#a49b8b] transition-colors hover:text-[#f2ede5]"
                    >
                      FeedSilo
                    </Link>
                  </div>
                </article>
              ))}
          </div>
        </div>

        <aside className="space-y-3 text-sm text-[#a49b8b]">
          <div className="rounded-lg border border-[#d6c9b21f] bg-[#ffffff08] p-4">
            <div className="mb-2 text-xs uppercase text-[#8a8174]">Index</div>
            <div className="text-2xl font-semibold text-[#f2ede5]">
              {response?.dimensions || dimensions}
            </div>
          </div>
          <div className="rounded-lg border border-[#d6c9b21f] bg-[#ffffff08] p-4">
            <div className="mb-2 text-xs uppercase text-[#8a8174]">Mode</div>
            <div className="text-2xl font-semibold capitalize text-[#f2ede5]">
              {response?.mode || mode}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
