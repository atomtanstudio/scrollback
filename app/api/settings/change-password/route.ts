import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth/auth";
import { getClient } from "@/lib/db/client";
import { sanitizeErrorMessage } from "@/lib/security/redact";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  let currentPassword: string, newPassword: string;
  try {
    const body = await req.json();
    currentPassword = body.currentPassword;
    newPassword = body.newPassword;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both current and new password are required" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const db = await getClient();
    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: NO_STORE_HEADERS });
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const password_hash = await bcrypt.hash(newPassword, 12);
    await db.user.update({ where: { email: session.user.email }, data: { password_hash } });

    return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, "Failed to change password") },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
