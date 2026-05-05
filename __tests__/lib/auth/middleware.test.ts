import { describe, it, expect } from "vitest";

/**
 * Test the middleware role enforcement logic.
 * We simulate the middleware logic directly rather than importing it,
 * since the NextAuth auth() wrapper makes integration testing complex.
 * This tests the exact same path-matching and role-enforcement logic.
 */

const PROTECTED_PAGES = ["/settings", "/admin"];
const ADMIN_ONLY_PAGES = ["/admin"];
const EXTENSION_API_PATHS = ["/api/extension/", "/api/ingest"];
const PUBLIC_API_PATHS = [
  "/api/auth/", "/api/setup/", "/api/admin/setup", "/api/stats",
  "/api/items", "/api/search", "/api/r2/", "/api/local-media/",
];
const PUBLIC_POST_PATHS: string[] = [];
const ADMIN_ONLY_GET_PATHS = [
  "/api/backfill/", "/api/media/backfill", "/api/media/local-backfill",
  "/api/embeddings/", "/api/search/reindex", "/api/data/", "/api/export",
];
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

interface MockAuth {
  user?: { id: string; email: string; role: string } | null;
}

function simulateMiddleware(pathname: string, method: string, auth: MockAuth | null) {
  if (SKIP_PATHS.some((p) => pathname.startsWith(p))) {
    return { action: "next" };
  }

  if (matchAny(pathname, PUBLIC_POST_PATHS) && method === "POST") {
    return { action: "next" };
  }

  if (matchAny(pathname, EXTENSION_API_PATHS)) {
    return { action: "next" };
  }

  if (matchAny(pathname, PUBLIC_API_PATHS) && !matchAny(pathname, ADMIN_ONLY_GET_PATHS)) {
    return { action: "next" };
  }

  const protectedApi =
    pathname.startsWith("/api/") &&
    !matchAny(pathname, EXTENSION_API_PATHS) &&
    !matchAny(pathname, PUBLIC_API_PATHS);

  const isAdminOnlyGet = matchAny(pathname, ADMIN_ONLY_GET_PATHS);

  const needsAuth =
    PROTECTED_PAGES.some((p) => pathname.startsWith(p)) ||
    protectedApi ||
    isAdminOnlyGet;

  if (!needsAuth) {
    return { action: "next" };
  }

  if (!auth?.user) {
    if (pathname.startsWith("/api/")) {
      return { action: "unauthorized", status: 401 };
    }
    return { action: "redirect", target: "/login" };
  }

  const role = auth.user.role ?? "admin";

  if (role === "admin") {
    return { action: "next" };
  }

  if (ADMIN_ONLY_PAGES.some((p) => pathname.startsWith(p))) {
    return { action: "redirect", target: "/?denied=1" };
  }

  if (isAdminOnlyGet) {
    return { action: "forbidden", status: 403 };
  }

  if (pathname.startsWith("/api/") && method !== "GET" && method !== "HEAD") {
    return { action: "forbidden", status: 403 };
  }

  return { action: "next" };
}

describe("Middleware role enforcement", () => {
  describe("Admin role", () => {
    const auth = { user: { id: "1", email: "admin@test.com", role: "admin" } };

    it("allows GET to public API paths", () => {
      expect(simulateMiddleware("/api/items", "GET", auth).action).toBe("next");
    });

    it("allows POST to settings", () => {
      expect(simulateMiddleware("/api/settings", "POST", auth).action).toBe("next");
    });

    it("allows access to /admin page", () => {
      expect(simulateMiddleware("/admin", "GET", auth).action).toBe("next");
    });

    it("allows GET to backfill paths", () => {
      expect(simulateMiddleware("/api/backfill/classify", "GET", auth).action).toBe("next");
    });

    it("allows POST to any API route", () => {
      expect(simulateMiddleware("/api/rss/feeds", "POST", auth).action).toBe("next");
    });

    it("allows DELETE to admin items", () => {
      expect(simulateMiddleware("/api/admin/items/123", "DELETE", auth).action).toBe("next");
    });

    it("allows GET to search/reindex", () => {
      expect(simulateMiddleware("/api/search/reindex", "GET", auth).action).toBe("next");
    });

    it("allows GET to embeddings generate", () => {
      expect(simulateMiddleware("/api/embeddings/generate-missing", "GET", auth).action).toBe("next");
    });
  });

  describe("Demo role", () => {
    const auth = { user: { id: "2", email: "demo@test.com", role: "demo" } };

    it("allows GET to public API items", () => {
      expect(simulateMiddleware("/api/items", "GET", auth).action).toBe("next");
    });

    it("allows GET to search", () => {
      expect(simulateMiddleware("/api/search", "GET", auth).action).toBe("next");
    });

    it("allows GET to search with query params", () => {
      expect(simulateMiddleware("/api/search?q=test", "GET", auth).action).toBe("next");
    });

    it("allows GET to settings (read-only view)", () => {
      expect(simulateMiddleware("/api/settings", "GET", auth).action).toBe("next");
    });

    it("allows access to /settings page", () => {
      expect(simulateMiddleware("/settings", "GET", auth).action).toBe("next");
    });

    it("blocks POST to settings with 403", () => {
      const result = simulateMiddleware("/api/settings", "POST", auth);
      expect(result.status).toBe(403);
    });

    it("blocks DELETE to admin items with 403", () => {
      const result = simulateMiddleware("/api/admin/items/123", "DELETE", auth);
      expect(result.status).toBe(403);
    });

    it("blocks POST to RSS feeds with 403", () => {
      const result = simulateMiddleware("/api/rss/feeds", "POST", auth);
      expect(result.status).toBe(403);
    });

    it("blocks GET to backfill/classify (admin-only GET)", () => {
      const result = simulateMiddleware("/api/backfill/classify", "GET", auth);
      expect(result.status).toBe(403);
    });

    it("blocks GET to embeddings/generate-missing (admin-only GET)", () => {
      const result = simulateMiddleware("/api/embeddings/generate-missing", "GET", auth);
      expect(result.status).toBe(403);
    });

    it("blocks GET to search/reindex (admin-only GET)", () => {
      const result = simulateMiddleware("/api/search/reindex", "GET", auth);
      expect(result.status).toBe(403);
    });

    it("blocks GET to data export (admin-only GET)", () => {
      const result = simulateMiddleware("/api/data/export", "GET", auth);
      expect(result.status).toBe(403);
    });

    it("blocks GET to media backfill (admin-only GET)", () => {
      const result = simulateMiddleware("/api/media/backfill", "GET", auth);
      expect(result.status).toBe(403);
    });

    it("redirects /admin page to /?denied=1", () => {
      const result = simulateMiddleware("/admin", "GET", auth);
      expect(result.action).toBe("redirect");
      expect(result.target).toBe("/?denied=1");
    });
  });

  describe("Viewer role (same restrictions as demo)", () => {
    const auth = { user: { id: "3", email: "viewer@test.com", role: "viewer" } };

    it("allows GET to items", () => {
      expect(simulateMiddleware("/api/items", "GET", auth).action).toBe("next");
    });

    it("blocks POST to settings", () => {
      expect(simulateMiddleware("/api/settings", "POST", auth).status).toBe(403);
    });

    it("blocks admin-only GET paths", () => {
      expect(simulateMiddleware("/api/backfill/classify", "GET", auth).status).toBe(403);
    });
  });

  describe("Unauthenticated requests", () => {
    it("returns 401 for the retired signup API", () => {
      expect(simulateMiddleware("/api/retired-signup", "POST", null).status).toBe(401);
    });

    it("redirects protected page to /login", () => {
      const result = simulateMiddleware("/settings", "GET", null);
      expect(result.action).toBe("redirect");
      expect(result.target).toBe("/login");
    });

    it("returns 401 for protected API route", () => {
      const result = simulateMiddleware("/api/admin/items", "GET", null);
      expect(result.status).toBe(401);
    });

    it("allows GET to public API paths without auth", () => {
      expect(simulateMiddleware("/api/items", "GET", null).action).toBe("next");
    });

    it("allows GET to search without auth", () => {
      expect(simulateMiddleware("/api/search", "GET", null).action).toBe("next");
    });
  });

  describe("Extension API passthrough", () => {
    it("passes extension capture through regardless of auth", () => {
      expect(simulateMiddleware("/api/extension/capture", "POST", null).action).toBe("next");
    });

    it("passes ingest through regardless of auth", () => {
      expect(simulateMiddleware("/api/ingest", "POST", null).action).toBe("next");
    });

    it("passes ingest/bulk through regardless of auth", () => {
      expect(simulateMiddleware("/api/ingest/bulk", "POST", null).action).toBe("next");
    });
  });

  describe("Framework paths", () => {
    it("skips _next paths", () => {
      expect(simulateMiddleware("/_next/static/chunk.js", "GET", null).action).toBe("next");
    });

    it("skips favicon", () => {
      expect(simulateMiddleware("/favicon.ico", "GET", null).action).toBe("next");
    });
  });
});
