import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HomePage } from "@/components/home-page";
import { DemoBanner } from "@/components/demo-banner";
import { fetchItems, fetchStats } from "@/lib/db/queries";
import { auth } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [{ items, totalCount, hasMore }, stats] = await Promise.all([
    fetchItems({ limit: 50, userId }),
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
        />
      </Suspense>
    </main>
  );
}
