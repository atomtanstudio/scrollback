import { NextRequest, NextResponse } from "next/server";
import { decode } from "@auth/core/jwt";

// Pages that require authentication
const PROTECTED_PAGES = ["/settings", "/admin"];

// Pages that require admin role specifically
const ADMIN_ONLY_PAGES = ["/admin"];

// API routes that use their own auth (Bearer token)
const EXTENSION_API_PATHS = [
  "/api/extension/",
  "/api/ingest",
];

// API routes that are always public (any method)
const PUBLIC_API_PATHS = [
  "/api/auth/",
  "/api/setup/",
  "/api/admin/setup",
  "/api/stats",
  "/api/items",
  "/api/search",
  "/api/r2/",
  "/api/local-media/",
];

// POST routes accessible without authentication
const PUBLIC_POST_PATHS = [
  "/api/waitlist",
];

// GET routes that trigger mutations or expensive operations — admin only
const ADMIN_ONLY_GET_PATHS = [
  "/api/backfill/",
  "/api/media/backfill",
  "/api/media/local-backfill",
  "/api/embeddings/",
  "/api/search/reindex",
  "/api/data/",
  "/api/export",
];

// Static/framework paths — skip entirely
const SKIP_PATHS = ["/_next", "/favicon.ico"];

function matchPath(pathname: string, pattern: string): boolean {
  if (pattern.endsWith("/")) {
    return pathname.startsWith(pattern);
  }
  return pathname === pattern ||
    pathname.startsWith(pattern + "/") ||
    pathname.startsWith(pattern + "?");
}

function matchAny(pathname: string, patterns: string[]): boolean {
  return patterns.some((p) => matchPath(pathname, p));
}

/**
 * Extract role from the NextAuth JWT session cookie.
 * Returns the role string, or null if the token can't be decoded.
 */
async function getRoleFromToken(request: NextRequest): Promise<string | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const sessionToken =
    request.cookies.get("__Secure-authjs.session-token")?.value ||
    request.cookies.get("authjs.session-token")?.value;

  if (!sessionToken) return null;

  try {
    const token = await decode({
      token: sessionToken,
      secret,
      salt: request.cookies.has("__Secure-authjs.session-token")
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
    });
    return (token?.role as string) ?? "admin";
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Skip framework paths
  if (SKIP_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Onboarding check (existing logic)
  if (
    !pathname.startsWith("/onboarding") &&
    pathname !== "/login" &&
    !pathname.startsWith("/api/")
  ) {
    const hasEnv = Boolean(process.env.DATABASE_URL && process.env.DATABASE_TYPE);
    const configured = request.cookies.get("feedsilo-configured");
    if (!hasEnv && configured?.value !== "true") {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  // Public POST paths — allow without auth (e.g., waitlist form)
  if (matchAny(pathname, PUBLIC_POST_PATHS) && method === "POST") {
    return NextResponse.next();
  }

  // Extension API routes — handled by their own Bearer token auth
  if (matchAny(pathname, EXTENSION_API_PATHS)) {
    return NextResponse.next();
  }

  // Public API routes — allow all methods
  // But check admin-only GET paths first (more specific takes priority)
  if (matchAny(pathname, PUBLIC_API_PATHS) && !matchAny(pathname, ADMIN_ONLY_GET_PATHS)) {
    return NextResponse.next();
  }

  const protectedApi =
    pathname.startsWith("/api/") &&
    !matchAny(pathname, EXTENSION_API_PATHS) &&
    !matchAny(pathname, PUBLIC_API_PATHS);

  const isAdminOnlyGet = matchAny(pathname, ADMIN_ONLY_GET_PATHS);

  // Check if this request needs auth
  const needsAuth =
    PROTECTED_PAGES.some((p) => pathname.startsWith(p)) ||
    protectedApi ||
    isAdminOnlyGet;

  if (!needsAuth) {
    return NextResponse.next();
  }

  // Check for NextAuth session token (same cookie check as the original middleware)
  const sessionToken =
    request.cookies.get("__Secure-authjs.session-token") ||
    request.cookies.get("authjs.session-token");

  if (!sessionToken) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // --- Role enforcement for authenticated users ---
  const role = await getRoleFromToken(request) ?? "admin";

  if (role === "admin") {
    return NextResponse.next();
  }

  // Non-admin: block admin-only pages
  if (ADMIN_ONLY_PAGES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/?denied=1", request.url));
  }

  // Non-admin: block admin-only GET paths (mutations disguised as GETs)
  if (isAdminOnlyGet) {
    return NextResponse.json(
      { error: "Demo account is view-only" },
      { status: 403 }
    );
  }

  // Non-admin: block all non-GET/HEAD API requests (default-deny)
  if (pathname.startsWith("/api/") && method !== "GET" && method !== "HEAD") {
    return NextResponse.json(
      { error: "Demo account is view-only" },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
