import { NextRequest, NextResponse } from "next/server";
import { validateCaptureSecret } from "@/lib/auth/capture-secret";
import { getClient } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  const auth = await validateCaptureSecret(request);
  if (!auth.valid || !auth.userId) {
    const status = auth.error === "CAPTURE_SECRET not configured on server" ? 500 : 401;
    return NextResponse.json({ success: false, error: auth.error }, { status });
  }

  const db = await getClient();
  const { searchParams } = request.nextUrl;
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "5", 10), 1), 25);

  const countRows = await db.$queryRaw<Array<{ remaining: bigint }>>`
    SELECT COUNT(*)::bigint AS remaining
    FROM (
      SELECT conversation_id
      FROM content_items
      WHERE user_id = ${auth.userId}::uuid
        AND source_type = 'thread'
        AND conversation_id IS NOT NULL
      GROUP BY conversation_id
      HAVING COUNT(*) = 1
    ) singleton_threads
  `;
  const remaining = Number(countRows[0]?.remaining || 0);

  const groups = await db.$queryRaw<Array<{ conversation_id: string; latest_created_at: Date }>>`
    SELECT conversation_id, MAX(created_at) AS latest_created_at
    FROM content_items
    WHERE user_id = ${auth.userId}::uuid
      AND source_type = 'thread'
      AND conversation_id IS NOT NULL
    GROUP BY conversation_id
    HAVING COUNT(*) = 1
    ORDER BY MAX(created_at) DESC
    LIMIT ${limit}
  `;

  const conversationIds = groups.map((group: { conversation_id: string }) => group.conversation_id);
  const items = conversationIds.length
    ? await db.contentItem.findMany({
        where: {
          user_id: auth.userId,
          source_type: "thread",
          conversation_id: { in: conversationIds },
        },
        select: {
          id: true,
          external_id: true,
          conversation_id: true,
          original_url: true,
          author_handle: true,
          title: true,
          body_text: true,
          created_at: true,
        },
        orderBy: { created_at: "desc" },
      })
    : [];

  return NextResponse.json({
    success: true,
    remaining,
    items: items.map((item: {
      id: string;
      external_id: string | null;
      conversation_id: string | null;
      original_url: string | null;
      author_handle: string | null;
      title: string;
      body_text: string;
      created_at: Date;
    }) => ({
      id: item.id,
      external_id: item.external_id,
      conversation_id: item.conversation_id,
      url: item.original_url || (item.author_handle && item.external_id
        ? `https://x.com/${item.author_handle}/status/${item.external_id}`
        : item.external_id
          ? `https://x.com/i/web/status/${item.external_id}`
          : null),
      title: item.title,
      body_preview: item.body_text.slice(0, 160),
      created_at: item.created_at,
    })).filter((item: { url: string | null }) => item.url),
  });
}
