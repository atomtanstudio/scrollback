import { notFound } from "next/navigation";
import { fetchItemById } from "@/lib/db/queries";
import type { Metadata } from "next";
import type { DetailItem } from "@/lib/db/types";
import { ItemDetailPage } from "@/components/detail/item-detail-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = await fetchItemById(id);
  if (!item) return { title: "Not Found" };

  return {
    title: `${item.title || item.body_text.slice(0, 60)} — FeedSilo`,
    description: item.body_text.slice(0, 160),
  };
}

export default async function ItemDetailPageRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await fetchItemById(id);
  if (!item) notFound();
  const serializedItem = JSON.parse(JSON.stringify(item)) as DetailItem;

  return (
    <main className="min-h-screen">
      <ItemDetailPage item={serializedItem} />
    </main>
  );
}
