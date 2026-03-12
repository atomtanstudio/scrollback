import { NextRequest, NextResponse } from "next/server";
import { validateCaptureSecret } from "@/lib/auth/capture-secret";

export async function POST(request: NextRequest) {
  const auth = validateCaptureSecret(request);
  if (!auth.valid) {
    const status = auth.error === "CAPTURE_SECRET not configured on server" ? 500 : 401;
    return NextResponse.json({ success: false, error: auth.error }, { status });
  }
  return NextResponse.json({ success: true });
}
