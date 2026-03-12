import { NextRequest, NextResponse } from "next/server";
import { getSearchProvider } from "@/lib/db/search-provider";
import { mergeAndRankResults } from "@/lib/search/hybrid";
import { generateEmbedding } from "@/lib/embeddings/gemini";
import type { SearchFilters, SearchOptions } from "@/lib/db/types";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    );
  }

  const mode = (searchParams.get("mode") || "hybrid") as
    | "keyword"
    | "semantic"
    | "hybrid";
  const type = searchParams.get("type") || undefined;
  const author = searchParams.get("author") || undefined;
  const dateFrom = searchParams.get("date_from") || undefined;
  const dateTo = searchParams.get("date_to") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("per_page") || "20", 10))
  );

  const filters: SearchFilters = { type, author, dateFrom, dateTo };
  const opts: SearchOptions = { page, perPage };

  try {
    const provider = await getSearchProvider();
    const isAuthorQuery = query.startsWith("@");

    // Strip @ prefix for author search queries
    const authorQuery = isAuthorQuery ? query.slice(1) : query;

    // Run searches in parallel
    const keywordPromise =
      mode === "keyword" || mode === "hybrid"
        ? provider.keywordSearch(query, filters, opts)
        : Promise.resolve([]);

    const semanticPromise =
      mode === "semantic" || mode === "hybrid"
        ? generateEmbedding(query).then((emb) =>
            provider.semanticSearch(emb, filters, opts)
          )
        : Promise.resolve([]);

    const authorPromise =
      author || isAuthorQuery
        ? provider.authorSearch(author || authorQuery, filters, opts)
        : Promise.resolve([]);

    const countPromise = provider.countResults(query, filters);

    const [keywordResults, semanticResults, authorResults, total] =
      await Promise.all([
        keywordPromise,
        semanticPromise,
        authorPromise,
        countPromise,
      ]);

    const keywordWeight = parseFloat(
      process.env.SEARCH_KEYWORD_WEIGHT || "0.4"
    );
    const semanticWeight = parseFloat(
      process.env.SEARCH_VECTOR_WEIGHT || "0.6"
    );

    const results = mergeAndRankResults(
      keywordResults,
      semanticResults,
      authorResults,
      keywordWeight,
      semanticWeight
    );
    const trimmed = results.slice(0, perPage);

    return NextResponse.json({
      results: trimmed,
      total,
      page,
      per_page: perPage,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
