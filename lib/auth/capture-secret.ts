import { NextRequest } from "next/server";
import { getConfig } from "@/lib/config";

export function validateCaptureSecret(
  request: NextRequest
): { valid: boolean; error?: string } {
  // Priority: CAPTURE_SECRET env var > config pairingToken
  const captureSecret =
    process.env.CAPTURE_SECRET || getConfig()?.extension?.pairingToken;

  if (!captureSecret) {
    return { valid: false, error: "CAPTURE_SECRET not configured on server" };
  }

  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return { valid: false, error: "Missing Authorization header" };
  }

  const token = auth.slice(7);
  if (token !== captureSecret) {
    return { valid: false, error: "Invalid capture secret" };
  }

  return { valid: true };
}
