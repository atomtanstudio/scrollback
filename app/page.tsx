import { HomePage } from "@/components/home-page";
import { fetchItems, fetchStats } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ items, totalCount }, stats] = await Promise.all([
    fetchItems({ limit: 50 }),
    fetchStats(),
  ]);

  return (
    <main className="min-h-screen">
      <HomePage
        initialItems={JSON.parse(JSON.stringify(items))}
        totalCount={totalCount}
        stats={stats}
      />
    </main>
  );
}
