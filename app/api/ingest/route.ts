import { NextRequest, NextResponse } from "next/server";
import { validateCaptureSecret } from "@/lib/auth/capture-secret";
import { ingestItem } from "@/lib/ingest";
import type { CapturePayload } from "@/lib/db/types";
import { sanitizeErrorMessage } from "@/lib/security/redact";

export async function POST(request: NextRequest) {
  const auth = await validateCaptureSecret(request);
  if (!auth.valid || !auth.userId) {
    const status = auth.error === "CAPTURE_SECRET not configured on server" ? 500 : 401;
    return NextResponse.json({ success: false, error: auth.error }, { status });
  }

  try {
    const payload: CapturePayload = await request.json();
    if (!payload.external_id || !payload.body_text) {
      return NextResponse.json(
        { success: false, error: "external_id and body_text are required" },
        { status: 400 }
      );
    }
    const result = await ingestItem(payload, auth.userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Ingest error:", sanitizeErrorMessage(error, "Unknown error"));
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(error, "Unknown error") },
      { status: 500 }
    );
  }
}
