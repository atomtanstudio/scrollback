import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { getClient } from "@/lib/db/client";

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const prisma = await getClient();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      capture_token: true,
      created_at: true,
      _count: { select: { content_items: true, rss_feeds: true } },
    },
    orderBy: { created_at: "asc" },
  });

  return NextResponse.json({ users });
}
