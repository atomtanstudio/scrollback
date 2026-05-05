import { AdminPage } from "@/components/admin/admin-page";
import { auth } from "@/lib/auth/auth";
import { fetchStats } from "@/lib/db/queries";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — Scrollback" };
export const dynamic = "force-dynamic";

export default async function AdminRoute() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const stats = await fetchStats(session.user.id);

  return (
    <AdminPage isAuthed={true} captureCount={stats.total} />
  );
}
