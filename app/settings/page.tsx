import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/settings-page";
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

  try {
    stats = await fetchStats();
  } catch {
    // Config may not be set up yet
  }

  return <SettingsPage stats={stats} isAuthed={!!session?.user} />;
}
