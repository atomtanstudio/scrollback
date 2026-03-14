import { NextRequest, NextResponse } from "next/server";

// Pages that require authentication
const PROTECTED_PAGES = ["/settings", "/admin"];

// API routes that use their own auth (Bearer token)
const EXTENSION_API_PATHS = [
  "/api/extension/",
  "/api/ingest/",
];

// API routes that are always public
const PUBLIC_API_PATHS = [
  "/api/auth/",      // NextAuth routes
  "/api/setup/",     // Onboarding
  "/api/admin/setup", // First-time admin account creation
  "/api/stats",      // Stats for home page
  "/api/items",      // Public feed API
  "/api/search",     // Public search
  "/api/r2/",        // Media proxy
];

// Static/framework paths — skip entirely
const SKIP_PATHS = ["/_next", "/favicon.ico"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip framework paths
  if (SKIP_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Onboarding check (existing logic)
  if (!pathname.startsWith("/onboarding") && !pathname.startsWith("/api/")) {
    const hasEnv = process.env.DATABASE_URL && process.env.DATABASE_TYPE;
    const configured = request.cookies.get("feedsilo-configured");
    if (!hasEnv && configured?.value !== "true") {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  // Extension API routes — handled by their own Bearer token auth
  if (EXTENSION_API_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Public API routes — allow all methods
  if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const protectedApi =
    pathname.startsWith("/api/") &&
    !EXTENSION_API_PATHS.some((p) => pathname.startsWith(p)) &&
    !PUBLIC_API_PATHS.some((p) => pathname.startsWith(p));

  // Check if this request needs auth
  const needsAuth =
    PROTECTED_PAGES.some((p) => pathname.startsWith(p)) ||
    protectedApi;

  if (!needsAuth) {
    return NextResponse.next();
  }

  // Check for NextAuth session token
  const sessionToken =
    request.cookies.get("__Secure-authjs.session-token") ||
    request.cookies.get("authjs.session-token");

  if (!sessionToken) {
    // API routes return 401, pages redirect to login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
