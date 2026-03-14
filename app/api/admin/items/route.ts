import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getClient } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const db = await getClient();
  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "";
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (type) where.source_type = type;
  if (search) {
    where.OR = [
      { body_text: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { author_handle: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    db.contentItem.findMany({
      where,
      select: {
        id: true,
        external_id: true,
        source_type: true,
        title: true,
        body_text: true,
        author_handle: true,
        author_display_name: true,
        author_avatar_url: true,
        original_url: true,
        posted_at: true,
        created_at: true,
        media_items: { select: { original_url: true, stored_path: true, media_type: true } },
      },
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
    }),
    db.contentItem.count({ where }),
  ]);

  return NextResponse.json({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: items.map((item: any) => ({
      ...item,
      body_preview: item.body_text?.substring(0, 150) || "",
      thumbnail: (() => {
        // Prefer an image over a video for the thumbnail
        const img = item.media_items.find((m: any) => m.media_type === "image" || m.media_type === "gif");
        const first = img || item.media_items[0];
        if (!first) return null;
        return first.stored_path || first.original_url || null;
      })(),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function DELETE(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const db = await getClient();
  const { ids } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  const result = await db.contentItem.deleteMany({
    where: { id: { in: ids } },
  });

  return NextResponse.json({ success: true, deleted: result.count });
}
