import { NextResponse } from "next/server";
import { loadTokens } from "@/lib/xapi/token-store";

export async function GET() {
  try {
    const tokens = await loadTokens();
    if (!tokens) {
      return NextResponse.json({ connected: false });
    }
    return NextResponse.json({
      connected: true,
      username: tokens.xUsername,
      expires_at: tokens.expiresAt.toISOString(),
      expired: tokens.expiresAt.getTime() < Date.now(),
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
