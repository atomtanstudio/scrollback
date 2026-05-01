import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getClient } from "@/lib/db/client";

export const dynamic = "force-dynamic";

type ThreadGroup = {
  conversation_id: string;
  count: bigint;
  latest_created_at: Date;
};

type DistinctConversation = {
  conversation_id: string | null;
};

type SingletonRoot = {
  id: string;
  external_id: string | null;
  conversation_id: string | null;
  author_handle: string | null;
  author_display_name: string | null;
  title: string;
  body_text: string;
  original_url: string | null;
  created_at: Date;
};

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const db = await getClient();
  const { searchParams } = request.nextUrl;
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 500);
  const requestedUserId = searchParams.get("userId");
  const targetUserId = session.user.role === "admin" && requestedUserId
    ? requestedUserId
    : session.user.id;

  const [totalThreadRows, groupedThreadCount, singletonGroups] = await Promise.all([
    db.contentItem.count({
      where: {
        user_id: targetUserId,
        source_type: "thread",
      },
    }),
    db.contentItem.findMany({
      where: {
        user_id: targetUserId,
        source_type: "thread",
        conversation_id: { not: null },
      },
      select: { conversation_id: true },
      distinct: ["conversation_id"],
    }).then((rows: DistinctConversation[]) => rows.length),
    db.$queryRaw<ThreadGroup[]>`
      SELECT conversation_id, COUNT(*)::bigint AS count, MAX(created_at) AS latest_created_at
      FROM content_items
      WHERE user_id = ${targetUserId}::uuid
        AND source_type = 'thread'
        AND conversation_id IS NOT NULL
      GROUP BY conversation_id
      HAVING COUNT(*) = 1
      ORDER BY MAX(created_at) DESC
      LIMIT ${limit}
    `,
  ]);

  const conversationIds = singletonGroups.map((group: ThreadGroup) => group.conversation_id);
  const roots: SingletonRoot[] = conversationIds.length
    ? await db.contentItem.findMany({
        where: {
          user_id: targetUserId,
          source_type: "thread",
          conversation_id: { in: conversationIds },
        },
        select: {
          id: true,
          external_id: true,
          conversation_id: true,
          author_handle: true,
          author_display_name: true,
          title: true,
          body_text: true,
          original_url: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
      })
    : [];

  return NextResponse.json({
    success: true,
    totalThreadRows,
    groupedThreadCount,
    singletonThreadCount: singletonGroups.length,
    singletons: roots.map((item: SingletonRoot) => ({
      id: item.id,
      external_id: item.external_id,
      conversation_id: item.conversation_id,
      author_handle: item.author_handle,
      author_display_name: item.author_display_name,
      title: item.title,
      body_preview: item.body_text.slice(0, 160),
      original_url: item.original_url,
      created_at: item.created_at,
    })),
  });
}
