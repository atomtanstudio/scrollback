import { NextResponse } from "next/server";
import { getClient } from "@/lib/db/client";

export async function POST(request: Request) {
  try {
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
      console.log(`[waitlist] New signup: ${email} (notify: ${process.env.WAITLIST_NOTIFY_EMAIL})`);
    }

    return NextResponse.json({ success: true, alreadyRegistered: false });
  } catch (err) {
    console.error("[waitlist] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
