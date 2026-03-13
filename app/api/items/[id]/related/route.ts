import { NextRequest, NextResponse } from "next/server";
import { fetchRelatedItems } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const limit = Math.min(12, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "6", 10)));
    const items = await fetchRelatedItems(id, limit);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Related items fetch error:", error);
    return NextResponse.json({ items: [] });
  }
}
