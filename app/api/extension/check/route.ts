import { NextRequest, NextResponse } from "next/server";
import { validateCaptureSecret } from "@/lib/auth/capture-secret";
import { getClient } from "@/lib/db/client";

export async function POST(request: NextRequest) {
  const auth = await validateCaptureSecret(request);
  if (!auth.valid || !auth.userId) {
    const status = auth.error === "CAPTURE_SECRET not configured on server" ? 500 : 401;
    return NextResponse.json({ success: false, error: auth.error }, { status });
  }

  // Fetch user info to return to the extension
  try {
    const prisma = await getClient();
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true, role: true },
    });
    return NextResponse.json({ success: true, user });
  } catch {
    return NextResponse.json({ success: true });
  }
}
