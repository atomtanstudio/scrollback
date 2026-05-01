import { NextResponse } from "next/server";
import { deleteTokens } from "@/lib/xapi/token-store";
import { requireAdmin } from "@/lib/auth/session";

export async function POST() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    await deleteTokens();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to disconnect" },
      { status: 500 }
    );
  }
}
