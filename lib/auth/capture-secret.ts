import { NextRequest } from "next/server";
import { getClient } from "@/lib/db/client";

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

  try {
    const prisma = await getClient();

    // Look up the user by their per-user capture token
    const user = await prisma.user.findUnique({
      where: { capture_token: token },
      select: { id: true, email: true },
    });

    if (user) {
      return { valid: true, userId: user.id };
    }

    // Fallback: if CAPTURE_SECRET env var matches, route to the first admin user.
    // This handles existing extensions that haven't switched to per-user tokens yet.
    const captureSecret = process.env.CAPTURE_SECRET;
    if (captureSecret && token === captureSecret) {
      const admin = await prisma.user.findFirst({
        where: { role: "admin" },
        orderBy: { created_at: "asc" },
        select: { id: true },
      });
      if (admin) {
        console.log("[capture-auth] Matched legacy CAPTURE_SECRET → admin user");
        return { valid: true, userId: admin.id };
      }
    }

    return { valid: false, error: "Invalid capture token" };
  } catch (err) {
    console.error("[capture-auth] Token lookup failed:", err instanceof Error ? err.message : err);
    return { valid: false, error: "Token validation failed" };
  }
}
