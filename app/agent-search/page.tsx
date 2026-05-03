import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AgentSearchPage } from "@/components/agent-memory/agent-search-page";
import { DemoBanner } from "@/components/demo-banner";
import { auth } from "@/lib/auth/auth";

export const metadata: Metadata = {
  title: "Agent Search - FeedSilo",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/agent-search");

  return (
    <main className="min-h-screen">
      <DemoBanner role={session.user.role} />
      <AgentSearchPage
        isAuthed={true}
        isAdmin={session.user.role === "admin"}
      />
    </main>
  );
}
