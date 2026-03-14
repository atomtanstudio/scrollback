import { AdminPage } from "@/components/admin/admin-page";
import { auth } from "@/lib/auth/auth";
import { fetchStats } from "@/lib/db/queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — FeedSilo" };
export const dynamic = "force-dynamic";

export default async function AdminRoute() {
  const t0 = Date.now();
  console.log(`[ADMIN] start render`);
  const [session, stats] = await Promise.all([auth(), fetchStats()]);
  console.log(`[ADMIN] auth+stats done in ${Date.now() - t0}ms, authed=${!!session?.user}`);

  return (
    <AdminPage isAuthed={!!session?.user} captureCount={stats.total} />
  );
}
