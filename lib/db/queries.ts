import { getClient, getDatabaseType } from "./client";
import {
  parsePinnedFilters,
  rankSuggestedPinnedFilters,
  type SuggestedPinnedFilter,
} from "@/lib/pinned-filters";
import { sanitizeArticleHtml } from "@/lib/security/html";

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

type StoredHtmlItem = {
  body_html?: string | null;
  original_url?: string | null;
};

type ItemWithPreviewMedia = {
  id: string;
  source_type: string;
  conversation_id: string | null;
  media_items?: Array<{ media_type?: string | null }>;
};

type ThreadPreviewMediaRow = {
  media_type: string | null;
  position_in_content: number | null;
  content_item?: {
    conversation_id: string | null;
    posted_at: Date | string | null;
    created_at: Date | string;
  };
  [key: string]: unknown;
};

function mediaPreviewPriority(mediaType: string | null | undefined): number {
  if (mediaType === "image" || mediaType === "gif") return 0;
  if (mediaType === "video") return 1;
  return 2;
}

function threadPreviewMediaTime(media: ThreadPreviewMediaRow): number {
  return new Date(media.content_item?.posted_at ?? media.content_item?.created_at ?? 0).getTime();
}

function sanitizeStoredArticleHtml<T extends StoredHtmlItem>(item: T | null): T | null {
  if (!item?.body_html) return item;
  return {
    ...item,
    body_html: sanitizeArticleHtml(item.body_html, item.original_url) || null,
  } as T;
}

async function hydrateThreadPreviewMedia<T extends ItemWithPreviewMedia>(items: T[]): Promise<T[]> {
  const prisma = await getClient();
  const conversationIds = Array.from(
    new Set(
      items
        .filter((item) => {
          if (item.source_type !== "thread" || !item.conversation_id) return false;
          return mediaPreviewPriority(item.media_items?.[0]?.media_type) > 0;
        })
        .map((item) => item.conversation_id as string)
    )
  );

  if (conversationIds.length === 0) return items;

  const mediaRows: ThreadPreviewMediaRow[] = await prisma.media.findMany({
    where: {
      content_item: {
        conversation_id: { in: conversationIds },
        source_type: "thread",
      },
    },
    include: {
      content_item: {
        select: {
          conversation_id: true,
          posted_at: true,
          created_at: true,
        },
      },
    },
    orderBy: [
      { content_item: { posted_at: "asc" } },
      { content_item: { created_at: "asc" } },
      { position_in_content: "asc" },
    ],
  });

  const firstMediaByConversation = new Map<string, (typeof mediaRows)[number]>();
  const sortedMediaRows = mediaRows.sort((a, b) => {
    const priorityDelta = mediaPreviewPriority(a.media_type) - mediaPreviewPriority(b.media_type);
    if (priorityDelta !== 0) return priorityDelta;

    const aTime = threadPreviewMediaTime(a);
    const bTime = threadPreviewMediaTime(b);
    if (aTime !== bTime) return aTime - bTime;

    return (a.position_in_content ?? 0) - (b.position_in_content ?? 0);
  });

  for (const media of sortedMediaRows) {
    const conversationId = media.content_item?.conversation_id;
    if (!conversationId || firstMediaByConversation.has(conversationId)) continue;
    firstMediaByConversation.set(conversationId, media);
  }

  return items.map((item) => {
    if (item.source_type !== "thread" || !item.conversation_id) {
      return item;
    }

    const previewMedia = firstMediaByConversation.get(item.conversation_id);
    if (!previewMedia) return item;
    if (mediaPreviewPriority(item.media_items?.[0]?.media_type) <= mediaPreviewPriority(previewMedia.media_type)) {
      return item;
    }

    const media = { ...previewMedia };
    delete media.content_item;
    return {
      ...item,
      media_items: [media],
    };
  });
}

export async function fetchItems(options: FetchItemsOptions) {
  const prisma = await getClient();
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
    baseWhere.OR = [
      { tags: { some: { tag: { slug: tag } } } },
      { categories: { some: { category: { slug: tag } } } },
    ];
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
  const dedupableThreadWhere = {
    ...baseWhere,
    source_type: "thread",
    conversation_id: { not: null },
    author_handle: { not: null },
    ...excludeFilter,
  };
  const orphanThreadWhere = {
    ...baseWhere,
    source_type: "thread",
    OR: [
      { conversation_id: null },
      { author_handle: null },
    ],
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

  // Pick one card per conversation, choosing the earliest captured post as the root.
  // This keeps reply-rich threads from flooding the feed even when captures include
  // replies from multiple authors.
  const dedupeThreads = <T extends {
    conversation_id: string | null;
    posted_at: Date | string | null;
    created_at: Date | string;
  }>(rows: T[]): T[] => {
    const earliestByConversation = new Map<string, T>();
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

    return Array.from(earliestByConversation.values())
      .sort((a, b) => itemSortKey(b) - itemSortKey(a))
      .slice(0, batchSize);
  };

  // Fetch non-thread items and deduplicated thread items separately, then merge.
  // This avoids the problem where a single thread with 100 replies drowns out
  // all other content when fetching a flat list.
  const isThreadFilter = type === "thread" || !type;

  const [nonThreadItems, orphanThreadItems, threadItems, totalCount] = await Promise.all([
    // Non-thread items (skip if filtering to threads only)
    type === "thread"
      ? Promise.resolve([])
      : prisma.contentItem.findMany({
          where: nonThreadWhere,
          include,
          orderBy,
          take: batchSize,
        }),
    // Keep thread captures that cannot be safely deduplicated visible in the feed.
    isThreadFilter
      ? prisma.contentItem.findMany({
          where: orphanThreadWhere,
          include,
          orderBy,
          take: batchSize,
        })
      : Promise.resolve([]),
    // One card per conversation. Replies from other authors are still stored and
    // shown on the detail page, but do not become separate feed cards.
    isThreadFilter
      ? prisma.contentItem.findMany({
          where: dedupableThreadWhere,
          include,
          orderBy: [{ created_at: "desc" }],
          take: Math.max(batchSize * 6, 100),
        }).then((rows: Awaited<ReturnType<typeof prisma.contentItem.findMany>>) => dedupeThreads(rows))
      : Promise.resolve([]),
    prisma.contentItem.count({ where: baseWhere }),
  ]);

  // Merge and sort by created_at descending, then trim to the requested batch size.
  // `hasMore` must be based on the deduplicated feed result, not raw content row counts.
  const mergedCandidates = [...nonThreadItems, ...orphanThreadItems, ...threadItems]
    .sort((a, b) => itemSortKey(b) - itemSortKey(a));
  const hasMore = mergedCandidates.length > limit;
  const merged = await hydrateThreadPreviewMedia(mergedCandidates.slice(0, limit));

  return { items: merged, hasMore, totalCount };
}

export async function fetchStats(userId: string) {
  const prisma = await getClient();

  const [total, tweets, rawThreads, articles, rss, art] = await Promise.all([
    prisma.contentItem.count({ where: { user_id: userId } }),
    prisma.contentItem.count({ where: { source_type: "tweet", user_id: userId } }),
    // Deduplicated thread count: one per conversation, plus thread captures that
    // cannot be deduplicated safely.
    prisma.contentItem.findMany({
      where: { source_type: "thread", conversation_id: { not: null }, author_handle: { not: null }, user_id: userId },
      select: { conversation_id: true, author_handle: true, posted_at: true, created_at: true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).then(async (rows: any[]) => {
      const byConv = new Map<string, { author_handle: string | null; posted_at: Date | string | null; created_at: Date | string }>();
      for (const row of rows) {
        if (!row.conversation_id) continue;
        const existing = byConv.get(row.conversation_id);
        const rowTime = new Date(row.posted_at ?? row.created_at).getTime();
        const existingTime = existing
          ? new Date(existing.posted_at ?? existing.created_at).getTime()
          : Number.POSITIVE_INFINITY;
        if (!existing || rowTime < existingTime) {
          byConv.set(row.conversation_id, row);
        }
      }
      const orphanCount = await prisma.contentItem.count({
        where: {
          source_type: "thread",
          user_id: userId,
          OR: [{ conversation_id: null }, { author_handle: null }],
        },
      });
      return byConv.size + orphanCount;
    }),
    prisma.contentItem.count({ where: { source_type: "article", source_platform: { not: "rss" }, user_id: userId } }),
    prisma.contentItem.count({ where: { source_platform: "rss", user_id: userId } }),
    prisma.contentItem.count({
      where: { source_type: { in: ["image_prompt", "video_prompt"] }, user_id: userId },
    }),
  ]);

  const threads = typeof rawThreads === "number" ? rawThreads : 0;

  return { total, tweets, threads, articles, rss, art };
}

export async function fetchPinnedFilters(userId: string) {
  const prisma = await getClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pinned_filters: true },
  });

  return parsePinnedFilters(user?.pinned_filters);
}

export async function fetchSuggestedPinnedFilters(userId: string): Promise<SuggestedPinnedFilter[]> {
  const prisma = await getClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pinned_filters: true },
  });
  const currentFilters = parsePinnedFilters(user?.pinned_filters);

  const items = await prisma.contentItem.findMany({
    where: { user_id: userId },
    select: {
      tags: { select: { tag: { select: { slug: true, name: true } } } },
      categories: { select: { category: { select: { slug: true, name: true } } } },
    },
  });

  return rankSuggestedPinnedFilters(
    items.map((item: (typeof items)[number]) => [
      ...item.categories.map(
        ({ category }: (typeof item.categories)[number]) => ({
          slug: category.slug,
          label: category.name,
          source: "category" as const,
        })
      ),
      ...item.tags.map(
        ({ tag }: (typeof item.tags)[number]) => ({
          slug: tag.slug,
          label: tag.name,
          source: "tag" as const,
        })
      ),
    ]),
    currentFilters
  );
}

export async function fetchItemById(id: string, userId: string) {
  const prisma = await getClient();
  const item = await prisma.contentItem.findFirst({
    where: { id, user_id: userId },
    include: {
      media_items: true,
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
    },
  });

  return sanitizeStoredArticleHtml(item);
}

export async function fetchThreadChain(item: {
  source_type: string;
  author_handle: string | null;
  conversation_id?: string | null;
  user_id: string;
  id: string;
}) {
  if (item.source_type !== "thread" || !item.conversation_id) {
    return [];
  }

  const prisma = await getClient();

  const siblings = await prisma.contentItem.findMany({
    where: {
      source_type: "thread",
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
