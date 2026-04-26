import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";

/**
 * Require auth for API route handlers. Returns 401 if not authenticated.
 * Usage: const session = await requireAuth(); if (session instanceof NextResponse) return session;
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return session;
}

/**
 * Get the current user's ID from the session. Returns null if not authenticated.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
