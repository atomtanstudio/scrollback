import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { HomePage } from "@/components/home-page";
import { DemoBanner } from "@/components/demo-banner";
import {
  fetchItems,
  fetchPinnedFilters,
  fetchStats,
  fetchSuggestedPinnedFilters,
  type SortMode,
} from "@/lib/db/queries";
import { auth } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

const VALID_SORTS = new Set<SortMode>(["recent", "most_liked", "most_viewed"]);

export default async function TaggedHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { slug } = await params;
  if (!slug) notFound();

  const userId = session.user.id;
  const resolvedSearchParams = (await searchParams) || {};
  const rawType = Array.isArray(resolvedSearchParams.type) ? resolvedSearchParams.type[0] : resolvedSearchParams.type;
  const rawSort = Array.isArray(resolvedSearchParams.sort) ? resolvedSearchParams.sort[0] : resolvedSearchParams.sort;
  const sort: SortMode = rawSort && VALID_SORTS.has(rawSort as SortMode) ? (rawSort as SortMode) : "recent";

  const [{ items, totalCount, hasMore }, stats, pinnedFilters, suggestedFilters] = await Promise.all([
    fetchItems({ limit: 50, userId, type: rawType || undefined, tag: slug, sort }),
    fetchStats(userId),
    fetchPinnedFilters(userId),
    fetchSuggestedPinnedFilters(userId),
  ]);

  return (
    <main className="min-h-screen">
      <DemoBanner role={session.user.role} />
      <Suspense>
        <HomePage
          initialItems={JSON.parse(JSON.stringify(items))}
          totalCount={totalCount}
          initialHasMore={hasMore}
          stats={stats}
          initialPinnedFilters={pinnedFilters}
          initialSuggestedFilters={suggestedFilters}
          isAuthed={true}
          isAdmin={session.user.role === "admin"}
          initialType={rawType || ""}
          initialSort={sort}
          initialTag={slug}
        />
      </Suspense>
    </main>
  );
}
