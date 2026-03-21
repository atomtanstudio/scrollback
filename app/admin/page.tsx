import { AdminPage } from "@/components/admin/admin-page";
import { auth } from "@/lib/auth/auth";
import { fetchStats } from "@/lib/db/queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — FeedSilo" };
export const dynamic = "force-dynamic";

export default async function AdminRoute() {
  const [session, stats] = await Promise.all([auth(), fetchStats()]);

  return (
    <AdminPage isAuthed={!!session?.user} captureCount={stats.total} />
  );
}
