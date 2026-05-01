import { NextResponse } from "next/server";
import { getClient } from "@/lib/db/client";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 8;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = globalThis as typeof globalThis & {
  feedsiloWaitlistRateLimits?: Map<string, RateLimitEntry>;
};

function getRateLimitKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();
  return firstForwardedIp || request.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(request: Request): boolean {
  const now = Date.now();
  const key = getRateLimitKey(request);
  const store = rateLimitStore.feedsiloWaitlistRateLimits ?? new Map<string, RateLimitEntry>();
  rateLimitStore.feedsiloWaitlistRateLimits = store;

  for (const [entryKey, entry] of Array.from(store.entries())) {
    if (entry.resetAt <= now) store.delete(entryKey);
  }

  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

export async function POST(request: Request) {
  try {
    if (isRateLimited(request)) {
      return NextResponse.json(
        { error: "Too many waitlist signups. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(WINDOW_MS / 1000)) } }
      );
    }

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const db = await getClient();

    const existing = await db.waitlistEntry.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json({ success: true, alreadyRegistered: true });
    }

    await db.waitlistEntry.create({
      data: { email },
    });

    if (process.env.WAITLIST_NOTIFY_EMAIL) {
      console.log("[waitlist] New signup received; notification email is configured.");
    }

    return NextResponse.json({ success: true, alreadyRegistered: false });
  } catch (err) {
    console.error("[waitlist] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
