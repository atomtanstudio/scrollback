import { NextRequest, NextResponse } from "next/server";
import { validateCaptureSecret } from "@/lib/auth/capture-secret";
import { ingestItem } from "@/lib/ingest";
import type { CapturePayload, CaptureResult } from "@/lib/db/types";
import { sanitizeErrorMessage } from "@/lib/security/redact";

export async function POST(request: NextRequest) {
  const auth = validateCaptureSecret(request);
  if (!auth.valid) {
    const status = auth.error === "CAPTURE_SECRET not configured on server" ? 500 : 401;
    return NextResponse.json({ success: false, error: auth.error }, { status });
  }

  try {
    const body = await request.json();
    const items: CapturePayload[] = body.items;
    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: "'items' array is required" },
        { status: 400 }
      );
    }
    if (items.length > 100) {
      return NextResponse.json(
        { success: false, error: "Max 100 items per bulk request" },
        { status: 400 }
      );
    }

    let captured = 0,
      skipped = 0,
      errors = 0;
    const results: CaptureResult[] = [];

    for (const item of items) {
      try {
        const result = await ingestItem(item);
        if (result.already_exists) skipped++;
        else captured++;
        results.push(result);
      } catch (error) {
        errors++;
        results.push({
          success: false,
          already_exists: false,
          error: sanitizeErrorMessage(error, "Unknown error"),
        });
      }
    }

    return NextResponse.json({ success: true, captured, skipped, errors, results });
  } catch (error) {
    console.error("Bulk ingest error:", sanitizeErrorMessage(error, "Unknown error"));
    return NextResponse.json(
      { success: false, error: sanitizeErrorMessage(error, "Unknown error") },
      { status: 500 }
    );
  }
}
