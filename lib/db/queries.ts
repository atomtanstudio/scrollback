import { getClient, getDatabaseType } from "./client";

export interface FetchItemsOptions {
  limit?: number;
  type?: string;
  excludeIds?: string[];
  search?: string;
}

export async function fetchItems(options: FetchItemsOptions = {}) {
  const prisma = await getClient();
  const { limit = 50, type, excludeIds = [] } = options;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseWhere: any = {};

  if (type) {
    if (type === "art") {
      baseWhere.source_type = { in: ["image_prompt", "video_prompt"] };
    } else {
      baseWhere.source_type = type;
    }
  }

  const excludeFilter = excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {};

  const include = {
    media_items: true,
    categories: { include: { category: true } },
    tags: { include: { tag: true } },
  };

  // Fetch non-thread items and deduplicated thread items separately, then merge.
  // This avoids the problem where a single thread with 100 replies drowns out
  // all other content when fetching a flat list.
  const isThreadFilter = type === "thread" || !type;

  const [nonThreadItems, threadItems, totalCount] = await Promise.all([
    // Non-thread items (skip if filtering to threads only)
    type === "thread"
      ? Promise.resolve([])
      : prisma.contentItem.findMany({
          where: { ...baseWhere, source_type: { not: "thread" }, ...excludeFilter },
          include,
          orderBy: { created_at: "desc" },
          take: limit,
        }),
    // One thread per author: the same thread can be captured multiple times
    // from different entry points, yielding different conversation_ids.
    // Deduplicating by author_handle ensures only one thread card per author
    // appears in the feed regardless of how many captures occurred.
    // Within each author's threads, we pick the root tweet (earliest posted_at).
    isThreadFilter
      ? (prisma.$queryRawUnsafe(
          `SELECT DISTINCT ON (author_handle) id FROM (
             SELECT DISTINCT ON (conversation_id) id, author_handle, created_at
             FROM content_items
             WHERE source_type = 'thread'
               AND conversation_id IS NOT NULL
               ${excludeIds.length > 0 ? `AND id NOT IN (${excludeIds.map((_, i) => `$${i + 1}`).join(",")})` : ""}
             ORDER BY conversation_id, COALESCE(posted_at, created_at) ASC
           ) roots
           ORDER BY author_handle, created_at DESC
           LIMIT $${excludeIds.length + 1}`,
          ...excludeIds,
          limit,
        ) as Promise<Array<{ id: string }>>).then(async (rows) => {
          if (rows.length === 0) return [];
          return prisma.contentItem.findMany({
            where: { id: { in: rows.map((r) => r.id) } },
            include,
            orderBy: { created_at: "desc" },
          });
        })
      : Promise.resolve([]),
    prisma.contentItem.count({ where: baseWhere }),
  ]);

  // Merge and sort by created_at descending, then take the requested limit
  const merged = [...nonThreadItems, ...threadItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  const loadedCount = excludeIds.length + merged.length;
  const hasMore = loadedCount < totalCount;

  return { items: merged, hasMore, totalCount };
}

export async function fetchStats() {
  const prisma = await getClient();
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
  const prisma = await getClient();
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

  const prisma = await getClient();
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
  const dbType = getDatabaseType();
  if (dbType === "sqlite") {
    // pgvector not available on SQLite — return empty
    return [];
  }

  const prisma = await getClient();
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
