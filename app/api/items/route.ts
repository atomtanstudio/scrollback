import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/db/client";
import { fetchItems, type SortMode } from "@/lib/db/queries";
import { getMediaDisplayUrl } from "@/lib/media-url";
import { requireAuth } from "@/lib/auth/session";

const VALID_SORTS = new Set<SortMode>(["recent", "most_liked", "most_viewed"]);

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const userId = session.user.id;

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || undefined;
  const preferPublishedAt = type === "rss";

  // excludeIds mode: when excludeIds param is present, use shared query function
  const excludeIdsParam = searchParams.get("excludeIds");
  const sortParam = searchParams.get("sort") as SortMode | null;
  const sort: SortMode = sortParam && VALID_SORTS.has(sortParam) ? sortParam : "recent";
  const tag = searchParams.get("tag") || undefined;

  if (excludeIdsParam !== null) {
    const excludeIds = excludeIdsParam ? excludeIdsParam.split(",") : [];
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const result = await fetchItems({ limit, type, tag, excludeIds, sort, userId });
    return NextResponse.json(result);
  }

  // Existing offset-based pagination
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));

  const where: Record<string, unknown> = {
    processing_status: { not: "error" },
    user_id: userId,
  };
  if (type === "art") {
    where.source_type = { in: ["image_prompt", "video_prompt"] };
  } else if (type === "rss") {
    where.source_platform = "rss";
  } else if (type === "article") {
    where.source_type = "article";
    where.source_platform = { not: "rss" };
  } else if (type) {
    where.source_type = type;
  }
  if (tag) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (where as any).OR = [
      { tags: { some: { tag: { slug: tag } } } },
      { categories: { some: { category: { slug: tag } } } },
    ];
  }

  const prisma = await getClient();
  const [items, total] = await Promise.all([
    prisma.contentItem.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: where as any,
      orderBy: preferPublishedAt ? [{ posted_at: "desc" }, { created_at: "desc" }] : [{ created_at: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        media_items: {
          take: 1,
          orderBy: { position_in_content: "asc" },
        },
      },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.contentItem.count({ where: where as any }),
  ]);

  return NextResponse.json({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: items.map((item: any) => ({
      id: item.id,
      source_type: item.source_type,
      title: item.title,
      body_excerpt: item.body_text.slice(0, 200),
      author: {
        handle: item.author_handle,
        display_name: item.author_display_name,
        avatar_url: item.author_avatar_url,
      },
      source_url: item.original_url,
      posted_at: item.posted_at?.toISOString() ?? null,
      media_preview: item.media_items[0]
        ? {
            id: item.media_items[0].id,
            type: item.media_items[0].media_type,
            url: getMediaDisplayUrl(item.media_items[0].stored_path, item.media_items[0].original_url),
          }
        : null,
    })),
    total,
    page,
    per_page: perPage,
  });
}
