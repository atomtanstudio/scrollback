import { getClient, getDatabaseType } from "./client";

export interface FetchItemsOptions {
  limit?: number;
  type?: string;
  excludeIds?: string[];
  search?: string;
}

export async function fetchItems(options: FetchItemsOptions = {}) {
  const prisma = await getClient();
  const dbType = getDatabaseType();
  const { limit = 50, type, excludeIds = [] } = options;
  const batchSize = limit + 1;

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
  const nonThreadWhere = {
    ...excludeFilter,
    ...(Object.keys(baseWhere).length > 0 ? { AND: [baseWhere, { source_type: { not: "thread" } }] } : { source_type: { not: "thread" } }),
  };

  const include = {
    media_items: true,
    categories: { include: { category: true } },
    tags: { include: { tag: true } },
  };
  const itemTimestamp = (item: { posted_at?: Date | null; created_at: Date }) =>
    new Date(item.posted_at ?? item.created_at).getTime();

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
          orderBy: [{ posted_at: "desc" }, { created_at: "desc" }],
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
            where: {
              source_type: "thread",
              conversation_id: { not: null },
              ...excludeFilter,
            },
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
              .sort((a, b) => itemTimestamp(b) - itemTimestamp(a))
              .slice(0, batchSize);
          })
        : (prisma.$queryRawUnsafe(
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
            batchSize,
          ) as Promise<Array<{ id: string }>>).then(async (rows) => {
            if (rows.length === 0) return [];
            return prisma.contentItem.findMany({
              where: { id: { in: rows.map((r) => r.id) } },
              include,
              orderBy: [{ posted_at: "desc" }, { created_at: "desc" }],
            });
          })
      : Promise.resolve([]),
    prisma.contentItem.count({ where: baseWhere }),
  ]);

  // Merge and sort by created_at descending, then trim to the requested batch size.
  // `hasMore` must be based on the deduplicated feed result, not raw content row counts.
  const mergedCandidates = [...nonThreadItems, ...threadItems]
    .sort((a, b) => itemTimestamp(b) - itemTimestamp(a));
  const hasMore = mergedCandidates.length > limit;
  const merged = mergedCandidates.slice(0, limit);

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

export async function fetchThreadChain(item: {
  source_type: string;
  author_handle: string | null;
  conversation_id?: string | null;
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

export async function fetchRelatedItems(itemId: string, limit: number = 6) {
  const dbType = getDatabaseType();
  if (dbType === "sqlite") {
    // pgvector not available on SQLite — return empty
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
