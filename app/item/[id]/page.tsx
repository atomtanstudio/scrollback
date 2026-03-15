import { notFound } from "next/navigation";
import { fetchItemById, fetchThreadChain } from "@/lib/db/queries";
import { auth } from "@/lib/auth/auth";
import { getDisplayBodyText, getDisplayTitle } from "@/lib/content-display";
import type { Metadata } from "next";
import type { DetailItem, ContentItemWithMedia } from "@/lib/db/types";
import { ItemDetailPage } from "@/components/detail/item-detail-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = await fetchItemById(id);
  if (!item) return { title: "Not Found" };
  const displayTitle = getDisplayTitle(item);
  const displayBodyText = getDisplayBodyText(item);

  return {
    title: `${displayTitle || displayBodyText.slice(0, 60)} — FeedSilo`,
    description: displayBodyText.slice(0, 160),
  };
}

export default async function ItemDetailPageRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, session] = await Promise.all([fetchItemById(id), auth()]);
  if (!item) notFound();
  const serializedItem = JSON.parse(JSON.stringify(item)) as DetailItem;

  const threadSiblingsRaw = await fetchThreadChain(item);
  const threadSiblings = JSON.parse(JSON.stringify(threadSiblingsRaw)) as ContentItemWithMedia[];

  return (
    <main className="min-h-screen">
      <ItemDetailPage item={serializedItem} threadSiblings={threadSiblings} isAuthed={!!session?.user} />
    </main>
  );
}
