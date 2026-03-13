import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/onboarding",
  "/api/setup",
  "/_next",
  "/favicon.ico",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip check for public/exempt paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Fast path: env vars set (Docker/production deployments)
  if (process.env.DATABASE_URL && process.env.DATABASE_TYPE) {
    return NextResponse.next();
  }

  // Check for onboarding-complete cookie (set by /api/setup/migrate)
  const configured = request.cookies.get("feedsilo-configured");
  if (configured?.value === "true") {
    return NextResponse.next();
  }

  // Not configured — redirect to onboarding
  return NextResponse.redirect(new URL("/onboarding", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
