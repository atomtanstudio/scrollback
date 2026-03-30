import { NextResponse } from "next/server";
import { fetchStats } from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  try {
    const stats = await fetchStats(session.user.id);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Stats fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
