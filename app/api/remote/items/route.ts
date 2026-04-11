import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/db/client";
import { getMediaDisplayUrl } from "@/lib/media-url";
import { requireApiAccess } from "@/lib/auth/api-access";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 1000;

function parseBoolean(value: string | null): boolean | undefined {
  if (value == null) return undefined;
  if (value === "1" || value.toLowerCase() === "true") return true;
  if (value === "0" || value.toLowerCase() === "false") return false;
  return undefined;
}

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

export async function GET(request: NextRequest) {
  const access = await requireApiAccess(request);
  if (!access.ok) return access.response;

  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id") || undefined;
  const q = searchParams.get("q")?.trim() || undefined;
  const type = searchParams.get("type") || undefined;
  const tag = searchParams.get("tag") || undefined;
  const author = searchParams.get("author")?.trim() || undefined;
  const hasPrompt = parseBoolean(searchParams.get("has_prompt"));
  const since = parseDate(searchParams.get("since"));
  const until = parseDate(searchParams.get("until"));
  const format = (searchParams.get("format") || "json").toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("per_page") || "100", 10))
  );

  const prisma = await getClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    user_id: access.userId,
    processing_status: { not: "error" },
  };

  if (id) where.id = id;

  if (type) {
    if (type === "art") {
      where.source_type = { in: ["image_prompt", "video_prompt"] };
    } else if (type === "rss") {
      where.source_platform = "rss";
    } else if (type === "article") {
      where.source_type = "article";
      where.source_platform = { not: "rss" };
    } else {
      where.source_type = type;
    }
  }

  if (tag) {
    where.OR = [
      { tags: { some: { tag: { slug: tag } } } },
      { categories: { some: { category: { slug: tag } } } },
    ];
  }

  if (author) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { author_handle: { contains: author, mode: "insensitive" } },
          { author_display_name: { contains: author, mode: "insensitive" } },
        ],
      },
    ];
  }

  if (hasPrompt !== undefined) {
    where.has_prompt = hasPrompt;
  }

  if (since || until) {
    where.created_at = {
      ...(since ? { gte: since } : {}),
      ...(until ? { lte: until } : {}),
    };
  }

  if (q) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { body_text: { contains: q, mode: "insensitive" } },
          { translated_title: { contains: q, mode: "insensitive" } },
          { translated_body_text: { contains: q, mode: "insensitive" } },
          { ai_summary: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.contentItem.findMany({
      where,
      orderBy: [{ created_at: "desc" }],
      skip: id ? undefined : (page - 1) * perPage,
      take: id ? 1 : perPage,
      include: {
        media_items: {
          orderBy: [{ position_in_content: "asc" }],
        },
        tags: {
          include: { tag: true },
          orderBy: { tag: { name: "asc" } },
        },
        categories: {
          include: { category: true },
          orderBy: { category: { name: "asc" } },
        },
      },
    }),
    prisma.contentItem.count({ where }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload = items.map((item: any) => ({
    id: item.id,
    source_type: item.source_type,
    source_platform: item.source_platform,
    external_id: item.external_id,
    conversation_id: item.conversation_id,
    title: item.title,
    body_text: item.body_text,
    translated_title: item.translated_title,
    translated_body_text: item.translated_body_text,
    ai_summary: item.ai_summary,
    author_handle: item.author_handle,
    author_display_name: item.author_display_name,
    author_avatar_url: item.author_avatar_url,
    original_url: item.original_url,
    posted_at: item.posted_at?.toISOString() ?? null,
    created_at: item.created_at.toISOString(),
    updated_at: item.updated_at.toISOString(),
    language: item.language,
    has_prompt: item.has_prompt,
    prompt_type: item.prompt_type,
    prompt_text: item.prompt_text,
    likes: item.likes,
    retweets: item.retweets,
    replies: item.replies,
    views: item.views,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tags: item.tags.map(({ tag }: any) => ({
      id: tag.id,
      slug: tag.slug,
      name: tag.name,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    categories: item.categories.map(({ category }: any) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media: item.media_items.map((media: any) => ({
      id: media.id,
      type: media.media_type,
      original_url: media.original_url,
      stored_path: media.stored_path,
      display_url: getMediaDisplayUrl(media.stored_path, media.original_url),
      alt_text: media.alt_text,
      ai_description: media.ai_description,
      position_in_content: media.position_in_content,
      width: media.width,
      height: media.height,
      file_size_bytes: media.file_size_bytes,
    })),
  }));

  if (format === "ndjson") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Response(payload.map((item: any) => JSON.stringify(item)).join("\n"), {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(
    {
      items: payload,
      total,
      page,
      per_page: id ? payload.length : perPage,
      has_more: !id && page * perPage < total,
      auth_method: access.authMethod,
      filters: {
        id: id || null,
        q: q || null,
        type: type || null,
        tag: tag || null,
        author: author || null,
        has_prompt: hasPrompt ?? null,
        since: since?.toISOString() ?? null,
        until: until?.toISOString() ?? null,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
