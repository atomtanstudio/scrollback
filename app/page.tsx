import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HomePage } from "@/components/home-page";
import { DemoBanner } from "@/components/demo-banner";
import { fetchItems, fetchStats, type SortMode } from "@/lib/db/queries";
import { auth } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

const VALID_SORTS = new Set<SortMode>(["recent", "most_liked", "most_viewed"]);

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const params = (await searchParams) || {};
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const rawTag = Array.isArray(params.tag) ? params.tag[0] : params.tag;
  const rawSort = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const sort: SortMode = rawSort && VALID_SORTS.has(rawSort as SortMode) ? (rawSort as SortMode) : "recent";

  if (rawTag) {
    const next = new URLSearchParams();
    if (rawType) next.set("type", rawType);
    if (sort && sort !== "recent") next.set("sort", sort);
    const qs = next.toString();
    redirect(`/tag/${encodeURIComponent(rawTag)}${qs ? `?${qs}` : ""}`);
  }

  const [{ items, totalCount, hasMore }, stats] = await Promise.all([
    fetchItems({ limit: 50, userId, type: rawType || undefined, tag: rawTag || undefined, sort }),
    fetchStats(userId),
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
          isAuthed={true}
          isAdmin={session.user.role === "admin"}
        />
      </Suspense>
    </main>
  );
}
