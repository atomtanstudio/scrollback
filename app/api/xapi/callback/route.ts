import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForTokens } from "@/lib/xapi/oauth";
import { storeTokens } from "@/lib/xapi/token-store";
import { fetchMe } from "@/lib/xapi/client";
import { auth } from "@/lib/auth/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", "/settings");
    return NextResponse.redirect(loginUrl);
  }
  if (session.user.role !== "admin") {
    return NextResponse.redirect(
      new URL("/settings?xapi_error=forbidden", request.nextUrl.origin)
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?xapi_error=${encodeURIComponent(error)}`, request.nextUrl.origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?xapi_error=missing_params", request.nextUrl.origin)
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("xapi_state")?.value;
  const codeVerifier = cookieStore.get("xapi_code_verifier")?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL("/settings?xapi_error=invalid_state", request.nextUrl.origin)
    );
  }

  if (!codeVerifier) {
    return NextResponse.redirect(
      new URL("/settings?xapi_error=missing_verifier", request.nextUrl.origin)
    );
  }

  const clientId = process.env.XAPI_CLIENT_ID;
  const clientSecret = process.env.XAPI_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/settings?xapi_error=not_configured", request.nextUrl.origin)
    );
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/xapi/callback`;

    const tokens = await exchangeCodeForTokens({
      code,
      codeVerifier,
      clientId,
      clientSecret,
      redirectUri,
    });

    // Fetch user info
    const user = await fetchMe(tokens.access_token);

    // Store encrypted tokens
    await storeTokens({
      xUserId: user.id,
      xUsername: user.username,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scopes: "tweet.read users.read bookmark.read like.read offline.access",
    });

    // Clear cookies
    cookieStore.delete("xapi_code_verifier");
    cookieStore.delete("xapi_state");

    return NextResponse.redirect(
      new URL("/settings?xapi_connected=true", request.nextUrl.origin)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/settings?xapi_error=${encodeURIComponent(message)}`, request.nextUrl.origin)
    );
  }
}
