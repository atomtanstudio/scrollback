import { NextRequest, NextResponse } from "next/server";
import { generatePKCE, generateState, buildAuthorizeUrl } from "@/lib/xapi/oauth";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const clientId = process.env.XAPI_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "XAPI_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = generateState();

  // Determine redirect URI from request origin
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/xapi/callback`;

  const authorizeUrl = buildAuthorizeUrl({
    clientId,
    redirectUri,
    codeChallenge,
    state,
  });

  // Store PKCE verifier and state in cookies for the callback
  const cookieStore = await cookies();
  cookieStore.set("xapi_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });
  cookieStore.set("xapi_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(authorizeUrl);
}
