import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function getStatusId(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/status\/(\d+)/) || value.match(/^(\d+)$/);
  return match ? match[1] : null;
}

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const statusId = getStatusId(request.nextUrl.searchParams.get("status"));
  if (!statusId) {
    return NextResponse.json({ error: "Pass ?status=<tweet id or URL>" }, { status: 400 });
  }

  const db = await getClient();
  const rows = await db.contentItem.findMany({
    where: {
      user_id: session.user.id,
      source_type: "thread",
      OR: [
        { external_id: statusId },
        { conversation_id: statusId },
        { original_url: { contains: `/status/${statusId}` } },
      ],
    },
    select: {
      id: true,
      external_id: true,
      conversation_id: true,
      author_handle: true,
      title: true,
      created_at: true,
    },
    orderBy: { created_at: "desc" },
    take: 100,
  });

  const groups = new Map<string, number>();
  for (const row of rows) {
    const key = row.conversation_id || `missing:${row.id}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }

  return NextResponse.json({
    statusId,
    rowCount: rows.length,
    groupCount: groups.size,
    groups: Array.from(groups.entries()).map(([conversationId, count]) => ({ conversationId, count })),
    rows,
  });
}
