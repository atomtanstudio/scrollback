import { notFound } from "next/navigation";
import { fetchItemById } from "@/lib/db/queries";
import type { Metadata } from "next";
import type { DetailItem } from "@/lib/db/types";
// ItemDetailPage client component will be created in Phase 4,
// so for now import it conditionally or create a minimal placeholder

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

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await fetchItemById(id);

  if (!item) notFound();

  // Serialize for client component (strips Prisma metadata, converts Dates)
  const serializedItem = JSON.parse(JSON.stringify(item)) as DetailItem;

  // For now, render a basic layout since ItemDetailPage client component comes in Phase 4
  // Just render the data to prove the server component works
  return (
    <main className="min-h-screen">
      {/* Placeholder - will be replaced with <ItemDetailPage item={serializedItem} /> in Phase 4 */}
      <div className="max-w-[960px] mx-auto px-5 py-6">
        <div className="text-sm text-[#8888aa] mb-4">← Back to feed</div>
        <h1 className="font-heading text-2xl font-bold text-[#f0f0f5] mb-4">
          {serializedItem.title || "Untitled"}
        </h1>
        <p className="text-[#d8d8e8] leading-relaxed">
          {serializedItem.body_text}
        </p>
        <p className="text-xs text-[#555566] mt-4">
          Type: {serializedItem.source_type} · Media: {serializedItem.media_items.length} items
        </p>
      </div>
    </main>
  );
}
