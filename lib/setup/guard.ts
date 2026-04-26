import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getClient } from "@/lib/db/client";
import { getConfig, isConfigured } from "@/lib/config";
import { sanitizeErrorMessage } from "@/lib/security/redact";

type SetupGuardOptions = {
  allowAdmin?: boolean;
};

export async function requireSetupUnlocked(
  options: SetupGuardOptions = {}
): Promise<NextResponse | null> {
  if (!isConfigured(getConfig())) return null;

  try {
    const db = await getClient();
    const userCount = await db.user.count();
    if (userCount === 0) return null;

    if (options.allowAdmin) {
      const session = await auth();
      if (session?.user?.role === "admin") return null;
    }
  } catch (error) {
    console.warn("[setup] Failed to verify setup lock:", sanitizeErrorMessage(error, "Unknown error"));
    return NextResponse.json(
      { success: false, error: "Setup is locked for this instance" },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { success: false, error: "Setup is locked for this instance" },
    { status: 403 }
  );
}
