import { HomePage } from "@/components/home-page";
import { fetchItems, fetchStats } from "@/lib/db/queries";
import { auth } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ items, totalCount, hasMore }, stats, session] = await Promise.all([
    fetchItems({ limit: 50 }),
    fetchStats(),
    auth(),
  ]);

  return (
    <main className="min-h-screen">
      <HomePage
        initialItems={JSON.parse(JSON.stringify(items))}
        totalCount={totalCount}
        initialHasMore={hasMore}
        stats={stats}
        isAuthed={!!session?.user}
      />
    </main>
  );
}
