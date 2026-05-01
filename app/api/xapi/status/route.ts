import { NextResponse } from "next/server";
import { loadTokens } from "@/lib/xapi/token-store";
import { requireAdmin } from "@/lib/auth/session";

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

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
