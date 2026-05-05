import { notFound, redirect } from "next/navigation";
import { fetchItemById, fetchThreadChain } from "@/lib/db/queries";
import { auth } from "@/lib/auth/auth";
import { getDisplayBodyText, getDisplayTitle } from "@/lib/content-display";
import type { Metadata } from "next";
import type { DetailItem, ContentItemWithMedia } from "@/lib/db/types";
import { ItemDetailPage } from "@/components/detail/item-detail-page";
import { DemoBanner } from "@/components/demo-banner";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return { title: "Login Required" };
  const item = await fetchItemById(id, session.user.id);
  if (!item) return { title: "Not Found" };
  const displayTitle = getDisplayTitle(item);
  const displayBodyText = getDisplayBodyText(item);

  return {
    title: `${displayTitle || displayBodyText.slice(0, 60)} — Scrollback`,
    description: displayBodyText.slice(0, 160),
  };
}

export default async function ItemDetailPageRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const item = await fetchItemById(id, userId);
  if (!item) notFound();
  const serializedItem = JSON.parse(JSON.stringify(item)) as DetailItem;

  const threadSiblingsRaw = await fetchThreadChain(item);
  const threadSiblings = JSON.parse(JSON.stringify(threadSiblingsRaw)) as ContentItemWithMedia[];

  return (
    <main className="min-h-screen">
      <DemoBanner role={session.user.role} />
      <ItemDetailPage item={serializedItem} threadSiblings={threadSiblings} isAuthed={true} />
    </main>
  );
}
