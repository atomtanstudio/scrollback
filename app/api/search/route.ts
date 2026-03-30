import { NextRequest, NextResponse } from "next/server";
import { getSearchProvider } from "@/lib/db/search-provider";
import { mergeAndRankResults } from "@/lib/search/hybrid";
import { generateEmbedding } from "@/lib/embeddings/gemini";
import { getClient } from "@/lib/db/client";
import type { SearchFilters, SearchOptions } from "@/lib/db/types";
import { requireAuth } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const userId = session.user.id;

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
  const format = searchParams.get("format") || "default";
  const type = searchParams.get("type") || undefined;
  const author = searchParams.get("author") || undefined;
  const dateFrom = searchParams.get("date_from") || undefined;
  const dateTo = searchParams.get("date_to") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("per_page") || "50", 10))
  );

  const filters: SearchFilters = { type, author, dateFrom, dateTo, userId };
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

    // Full format: fetch complete ContentItemWithMedia for card rendering
    if (format === "full" && trimmed.length > 0) {
      const prisma = await getClient();
      const ids = trimmed.map((r) => r.id);
      const fullItems = await prisma.contentItem.findMany({
        where: { id: { in: ids }, user_id: userId },
        include: { media_items: true },
      });

      // Preserve search ranking order
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemMap = new Map(fullItems.map((item: any) => [item.id, item]));
      const ordered = ids.map((id) => itemMap.get(id)).filter(Boolean);

      return NextResponse.json({
        items: JSON.parse(JSON.stringify(ordered)),
        total,
        page,
        per_page: perPage,
      });
    }

    return NextResponse.json({
      results: trimmed,
      total,
      page,
      per_page: perPage,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
