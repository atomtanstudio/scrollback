import { prisma } from "./prisma";

export interface FetchItemsOptions {
  limit?: number;
  type?: string;
  excludeIds?: string[];
  search?: string;
}

export async function fetchItems(options: FetchItemsOptions = {}) {
  const { limit = 50, type, excludeIds = [] } = options;

  const baseWhere: any = {};

  if (type) {
    if (type === "art") {
      baseWhere.source_type = { in: ["image_prompt", "video_prompt"] };
    } else {
      baseWhere.source_type = type;
    }
  }

  const where = excludeIds.length > 0
    ? { ...baseWhere, id: { notIn: excludeIds } }
    : baseWhere;

  const [items, totalCount] = await Promise.all([
    prisma.contentItem.findMany({
      where,
      include: {
        media_items: true,
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { created_at: "desc" },
      take: limit,
    }),
    prisma.contentItem.count({ where: baseWhere }),
  ]);

  const loadedCount = excludeIds.length + items.length;
  const hasMore = loadedCount < totalCount;

  return { items, hasMore, totalCount };
}

export async function fetchStats() {
  const [total, tweets, threads, articles, art] = await Promise.all([
    prisma.contentItem.count(),
    prisma.contentItem.count({ where: { source_type: "tweet" } }),
    prisma.contentItem.count({ where: { source_type: "thread" } }),
    prisma.contentItem.count({ where: { source_type: "article" } }),
    prisma.contentItem.count({
      where: { source_type: { in: ["image_prompt", "video_prompt"] } },
    }),
  ]);

  return { total, tweets, threads, articles, art };
}

export async function fetchItemById(id: string) {
  return prisma.contentItem.findUnique({
    where: { id },
    include: {
      media_items: true,
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
    },
  });
}

export async function fetchThreadChain(item: { source_type: string; author_handle: string | null; posted_at: Date | null; id: string }) {
  if (item.source_type !== 'thread' || !item.author_handle) {
    return [];
  }

  const timeWindow = 24 * 60 * 60 * 1000; // 24 hours
  const postedAt = item.posted_at ? new Date(item.posted_at).getTime() : Date.now();

  const siblings = await prisma.contentItem.findMany({
    where: {
      source_type: 'thread',
      author_handle: item.author_handle,
      id: { not: item.id },
      posted_at: {
        gte: new Date(postedAt - timeWindow),
        lte: new Date(postedAt + timeWindow),
      },
    },
    include: {
      media_items: true,
    },
    orderBy: { posted_at: 'asc' },
    take: 20,
  });

  return siblings;
}

export async function fetchRelatedItems(itemId: string, limit: number = 6) {
  const results = await prisma.$queryRawUnsafe(`
    SELECT ci.id, ci.source_type, ci.title, ci.body_text,
           ci.author_handle, ci.author_display_name, ci.author_avatar_url,
           ci.original_url, ci.posted_at, ci.created_at,
           1 - (ci.embedding <=> (SELECT embedding FROM content_items WHERE id = $1)) as similarity
    FROM content_items ci
    WHERE ci.id != $1
      AND ci.embedding IS NOT NULL
      AND ci.processing_status != 'error'
    ORDER BY ci.embedding <=> (SELECT embedding FROM content_items WHERE id = $1)
    LIMIT $2
  `, itemId, limit);

  return results as Array<{
    id: string;
    source_type: string;
    title: string;
    body_text: string;
    author_handle: string | null;
    author_display_name: string | null;
    author_avatar_url: string | null;
    original_url: string | null;
    posted_at: Date | null;
    created_at: Date;
    similarity: number;
  }>;
}
