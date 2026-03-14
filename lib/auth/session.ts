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
