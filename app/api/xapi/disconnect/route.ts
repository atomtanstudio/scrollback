import { NextResponse } from "next/server";
import { deleteTokens } from "@/lib/xapi/token-store";

export async function POST() {
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
