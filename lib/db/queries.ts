import { getClient, getDatabaseType } from "./client";

export type SortMode = "recent" | "most_liked" | "most_viewed";

export interface FetchItemsOptions {
  limit?: number;
  type?: string;
  tag?: string;
  excludeIds?: string[];
  search?: string;
  sort?: SortMode;
  userId: string;
}

export async function fetchItems(options: FetchItemsOptions) {
  const prisma = await getClient();
  const dbType = getDatabaseType();
  const { limit = 50, type, tag, excludeIds = [], sort = "recent", userId } = options;
  const batchSize = limit + 1;
  const preferPublishedAt = type === "rss";

  const orderBy =
    sort === "most_liked"
      ? [{ likes: "desc" as const }, { created_at: "desc" as const }]
      : sort === "most_viewed"
        ? [{ views: "desc" as const }, { created_at: "desc" as const }]
        : preferPublishedAt
          ? [{ posted_at: "desc" as const }, { created_at: "desc" as const }]
          : [{ created_at: "desc" as const }];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseWhere: any = { user_id: userId };

  // Filter by tag slug via the join table
  if (tag) {
    baseWhere.tags = { some: { tag: { slug: tag } } };
  }

  if (type) {
    if (type === "art") {
      baseWhere.source_type = { in: ["image_prompt", "video_prompt"] };
    } else if (type === "rss") {
      baseWhere.source_platform = "rss";
    } else if (type === "article") {
      baseWhere.source_type = "article";
      baseWhere.source_platform = { not: "rss" };
    } else {
      baseWhere.source_type = type;
    }
  }

  const excludeFilter = excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {};
  const nonThreadWhere = {
    ...excludeFilter,
    ...(Object.keys(baseWhere).length > 0 ? { AND: [baseWhere, { source_type: { not: "thread" } }] } : { source_type: { not: "thread" } }),
  };
  const threadWhere = {
    ...baseWhere,
    source_type: "thread",
    conversation_id: { not: null },
    ...excludeFilter,
  };

  const include = {
    media_items: true,
    categories: { include: { category: true } },
    tags: { include: { tag: true } },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemSortKey = (item: any) => {
    if (sort === "most_liked") return item.likes ?? -1;
    if (sort === "most_viewed") return item.views ?? -1;
    return new Date((preferPublishedAt ? item.posted_at : null) ?? item.created_at).getTime();
  };

  // Fetch non-thread items and deduplicated thread items separately, then merge.
  // This avoids the problem where a single thread with 100 replies drowns out
  // all other content when fetching a flat list.
  const isThreadFilter = type === "thread" || !type;
  const useSqliteThreadDedupe = dbType === "sqlite";

  const [nonThreadItems, threadItems, totalCount] = await Promise.all([
    // Non-thread items (skip if filtering to threads only)
    type === "thread"
      ? Promise.resolve([])
      : prisma.contentItem.findMany({
          where: nonThreadWhere,
          include,
          orderBy,
          take: batchSize,
        }),
    // One thread per author: the same thread can be captured multiple times
    // from different entry points, yielding different conversation_ids.
    // Deduplicating by author_handle ensures only one thread card per author
    // appears in the feed regardless of how many captures occurred.
    // Within each author's threads, we pick the root tweet (earliest posted_at).
    isThreadFilter
      ? useSqliteThreadDedupe
        ? prisma.contentItem.findMany({
            where: threadWhere,
            include,
            orderBy: [{ created_at: "desc" }],
            take: Math.max(batchSize * 6, 100),
          }).then((rows: Awaited<ReturnType<typeof prisma.contentItem.findMany>>) => {
            const earliestByConversation = new Map<string, (typeof rows)[number]>();
            for (const row of rows) {
              if (!row.conversation_id) continue;
              const existing = earliestByConversation.get(row.conversation_id);
              const rowTime = new Date(row.posted_at ?? row.created_at).getTime();
              const existingTime = existing
                ? new Date(existing.posted_at ?? existing.created_at).getTime()
                : Number.POSITIVE_INFINITY;
              if (!existing || rowTime < existingTime) {
                earliestByConversation.set(row.conversation_id, row);
              }
            }

            const latestByAuthor = new Map<string, (typeof rows)[number]>();
            for (const row of Array.from(earliestByConversation.values())) {
              const authorKey = (row.author_handle || "").toLowerCase();
              if (!authorKey) continue;
              const existing = latestByAuthor.get(authorKey);
              const rowTime = new Date(row.created_at).getTime();
              const existingTime = existing
                ? new Date(existing.created_at).getTime()
                : Number.NEGATIVE_INFINITY;
              if (!existing || rowTime > existingTime) {
                latestByAuthor.set(authorKey, row);
              }
            }

            return Array.from(latestByAuthor.values())
              .sort((a, b) => itemSortKey(b) - itemSortKey(a))
              .slice(0, batchSize);
          })
        : (prisma.$queryRawUnsafe(
             `SELECT DISTINCT ON (author_handle) id FROM (
               SELECT DISTINCT ON (conversation_id) id, author_handle, created_at
               FROM content_items
               WHERE source_type = 'thread'
                 AND conversation_id IS NOT NULL
                 AND user_id = $1::uuid
                 ${tag ? `AND EXISTS (
                   SELECT 1
                   FROM content_tags ct
                   JOIN tags t ON t.id = ct.tag_id
                   WHERE ct.content_item_id = content_items.id
                     AND t.slug = $2
                 )` : ""}
                 ${excludeIds.length > 0 ? `AND id NOT IN (${excludeIds.map((_, i) => `$${i + (tag ? 3 : 2)}`).join(",")})` : ""}
               ORDER BY conversation_id, COALESCE(posted_at, created_at) ASC
             ) roots
             ORDER BY author_handle, created_at DESC
             LIMIT $${excludeIds.length + (tag ? 3 : 2)}`,
            userId,
            ...(tag ? [tag] : []),
            ...excludeIds,
            batchSize,
          ) as Promise<Array<{ id: string }>>).then(async (rows) => {
            if (rows.length === 0) return [];
            return prisma.contentItem.findMany({
              where: { id: { in: rows.map((r) => r.id) } },
              include,
              orderBy: [{ created_at: "desc" }],
            });
          })
      : Promise.resolve([]),
    prisma.contentItem.count({ where: baseWhere }),
  ]);

  // Merge and sort by created_at descending, then trim to the requested batch size.
  // `hasMore` must be based on the deduplicated feed result, not raw content row counts.
  const mergedCandidates = [...nonThreadItems, ...threadItems]
    .sort((a, b) => itemSortKey(b) - itemSortKey(a));
  const hasMore = mergedCandidates.length > limit;
  const merged = mergedCandidates.slice(0, limit);

  return { items: merged, hasMore, totalCount };
}

export async function fetchStats(userId: string) {
  const prisma = await getClient();
  const dbType = getDatabaseType();

  const [total, tweets, rawThreads, articles, rss, art] = await Promise.all([
    prisma.contentItem.count({ where: { user_id: userId } }),
    prisma.contentItem.count({ where: { source_type: "tweet", user_id: userId } }),
    // Deduplicated thread count: one per conversation, then one per author
    dbType === "sqlite"
      ? prisma.contentItem.findMany({
          where: { source_type: "thread", conversation_id: { not: null }, user_id: userId },
          select: { conversation_id: true, author_handle: true, posted_at: true, created_at: true },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).then((rows: any[]) => {
          // Pick earliest per conversation
          const byConv = new Map<string, { author_handle: string | null }>();
          for (const row of rows) {
            if (!row.conversation_id) continue;
            if (!byConv.has(row.conversation_id)) {
              byConv.set(row.conversation_id, row);
            }
          }
          // Unique authors
          const authors = new Set<string>();
          for (const row of Array.from(byConv.values())) {
            authors.add((row.author_handle || "").toLowerCase());
          }
          return authors.size;
        })
      : (prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM (
             SELECT DISTINCT ON (author_handle) author_handle FROM (
               SELECT DISTINCT ON (conversation_id) author_handle
               FROM content_items
               WHERE source_type = 'thread' AND conversation_id IS NOT NULL AND user_id = $1::uuid
               ORDER BY conversation_id, COALESCE(posted_at, created_at) ASC
             ) roots
             ORDER BY author_handle
           ) deduped`,
          userId
        ) as Promise<Array<{ count: bigint }>>).then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.contentItem.count({ where: { source_type: "article", source_platform: { not: "rss" }, user_id: userId } }),
    prisma.contentItem.count({ where: { source_platform: "rss", user_id: userId } }),
    prisma.contentItem.count({
      where: { source_type: { in: ["image_prompt", "video_prompt"] }, user_id: userId },
    }),
  ]);

  const threads = typeof rawThreads === "number" ? rawThreads : 0;

  return { total, tweets, threads, articles, rss, art };
}

export async function fetchItemById(id: string, userId: string) {
  const prisma = await getClient();
  return prisma.contentItem.findFirst({
    where: { id, user_id: userId },
    include: {
      media_items: true,
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
    },
  });
}

export async function fetchThreadChain(item: {
  source_type: string;
  author_handle: string | null;
  conversation_id?: string | null;
  user_id: string;
  id: string;
}) {
  if (item.source_type !== "thread" || !item.author_handle || !item.conversation_id) {
    return [];
  }

  const prisma = await getClient();

  const siblings = await prisma.contentItem.findMany({
    where: {
      source_type: "thread",
      author_handle: item.author_handle,
      conversation_id: item.conversation_id,
      user_id: item.user_id,
      id: { not: item.id },
    },
    include: {
      media_items: true,
    },
    orderBy: [{ posted_at: "asc" }, { created_at: "asc" }],
    take: 50,
  });

  return siblings;
}

export async function fetchRelatedItems(itemId: string, userId: string, limit: number = 6) {
  const dbType = getDatabaseType();
  if (dbType === "sqlite") {
    return [];
  }

  const prisma = await getClient();
  const results = await prisma.$queryRawUnsafe(`
    SELECT ci.id, ci.source_type, ci.title, ci.body_text,
           ci.translated_title, ci.translated_body_text,
           ci.author_handle, ci.author_display_name, ci.author_avatar_url,
           ci.original_url, ci.posted_at, ci.created_at,
           1 - (ci.embedding <=> (SELECT embedding FROM content_items WHERE id = $1)) as similarity
    FROM content_items ci
    WHERE ci.id != $1
      AND ci.user_id = $2::uuid
      AND ci.embedding IS NOT NULL
      AND ci.processing_status != 'error'
    ORDER BY ci.embedding <=> (SELECT embedding FROM content_items WHERE id = $1)
    LIMIT $3
  `, itemId, userId, limit);

  return results as Array<{
    id: string;
    source_type: string;
    title: string;
    body_text: string;
    translated_title?: string | null;
    translated_body_text?: string | null;
    author_handle: string | null;
    author_display_name: string | null;
    author_avatar_url: string | null;
    original_url: string | null;
    posted_at: Date | null;
    created_at: Date;
    similarity: number;
  }>;
}
