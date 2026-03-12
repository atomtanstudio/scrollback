import { NextRequest } from "next/server";

export function validateCaptureSecret(request: NextRequest): { valid: boolean; error?: string } {
  const captureSecret = process.env.CAPTURE_SECRET;
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
