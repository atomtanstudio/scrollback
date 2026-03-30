import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/settings-page";
import { DemoBanner } from "@/components/demo-banner";
import { fetchStats } from "@/lib/db/queries";
import { auth } from "@/lib/auth/auth";

export const metadata: Metadata = {
  title: "Settings — FeedSilo",
  description: "Configure your FeedSilo instance",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  let stats = { total: 0, tweets: 0, threads: 0, articles: 0, rss: 0, art: 0 };
  const session = await auth();
  const role = session?.user?.role ?? "admin";

  try {
    if (session?.user?.id) stats = await fetchStats(session.user.id);
  } catch {
    // Config may not be set up yet
  }

  return (
    <>
      <DemoBanner role={role} />
      <SettingsPage
        stats={stats}
        isAuthed={!!session?.user}
        isAdmin={role === "admin"}
        isReadOnly={role !== "admin"}
      />
    </>
  );
}
