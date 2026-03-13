import { NextResponse } from "next/server";
import { fetchStats } from "@/lib/db/queries";

export async function GET() {
  try {
    const stats = await fetchStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Stats fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
