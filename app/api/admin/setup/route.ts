import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getClient } from "@/lib/db/client";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Email and password (min 8 chars) required" },
      { status: 400 }
    );
  }

  const db = await getClient();

  // Only allow if no users exist yet (first-time setup)
  const existingCount = await db.user.count();
  if (existingCount > 0) {
    return NextResponse.json(
      { error: "Admin account already exists" },
      { status: 409 }
    );
  }

  const password_hash = await bcrypt.hash(password, 12);
  await db.user.create({
    data: { email, password_hash },
  });

  return NextResponse.json({ success: true });
}
