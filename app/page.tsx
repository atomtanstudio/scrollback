import { Suspense } from "react";
import { HomePage } from "@/components/home-page";
import { DemoBanner } from "@/components/demo-banner";
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
      <DemoBanner role={session?.user?.role} />
      <Suspense>
        <HomePage
          initialItems={JSON.parse(JSON.stringify(items))}
          totalCount={totalCount}
          initialHasMore={hasMore}
          stats={stats}
          isAuthed={!!session?.user}
        />
      </Suspense>
    </main>
  );
}
