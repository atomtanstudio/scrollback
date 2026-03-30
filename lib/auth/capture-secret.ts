import { NextRequest } from "next/server";
import { getClient } from "@/lib/db/client";
import { getConfig } from "@/lib/config";

export interface CaptureAuth {
  valid: boolean;
  userId?: string;
  error?: string;
}

export async function validateCaptureSecret(
  request: NextRequest
): Promise<CaptureAuth> {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return { valid: false, error: "Missing Authorization header" };
  }

  const token = auth.slice(7);

  // First, try to resolve a per-user capture token from the database
  try {
    const prisma = await getClient();
    const user = await prisma.user.findUnique({
      where: { capture_token: token },
      select: { id: true },
    });
    if (user) {
      return { valid: true, userId: user.id };
    }
  } catch {
    // DB lookup failed — fall through to legacy check
  }

  // Legacy fallback: match against CAPTURE_SECRET env var or config pairingToken
  // and assign to the first admin user
  const captureSecret =
    process.env.CAPTURE_SECRET || getConfig()?.extension?.pairingToken;

  if (captureSecret && token === captureSecret) {
    try {
      const prisma = await getClient();
      const admin = await prisma.user.findFirst({
        where: { role: "admin" },
        orderBy: { created_at: "asc" },
        select: { id: true },
      });
      if (admin) {
        return { valid: true, userId: admin.id };
      }
    } catch {
      // Fall through
    }
    return { valid: false, error: "No admin user found for legacy token" };
  }

  return { valid: false, error: "Invalid capture token" };
}
