import { prisma } from "./prisma";

export interface FetchItemsOptions {
  limit?: number;
  type?: string;
  excludeIds?: string[];
  search?: string;
}

export async function fetchItems(options: FetchItemsOptions = {}) {
  const { limit = 50, type, excludeIds = [], search } = options;

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
