import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getClient } from "@/lib/db/client";
import { getConfig, isConfigured } from "@/lib/config";
import { sanitizeErrorMessage } from "@/lib/security/redact";
import { getProvidedSetupToken, getSetupTokenHint, isValidSetupToken } from "@/lib/setup/token";

type SetupGuardOptions = {
  allowAdmin?: boolean;
};

export async function requireSetupUnlocked(
  request?: Request | null,
  options: SetupGuardOptions = {}
): Promise<NextResponse | null> {
  const token = getProvidedSetupToken(request);

  if (!isConfigured(getConfig())) {
    if (isValidSetupToken(token)) return null;
    return NextResponse.json(
      { success: false, error: `Setup token required. ${getSetupTokenHint()}` },
      { status: 403 }
    );
  }

  try {
    const db = await getClient();
    const userCount = await db.user.count();
    if (userCount === 0) {
      if (isValidSetupToken(token)) return null;
      return NextResponse.json(
        { success: false, error: `Setup token required. ${getSetupTokenHint()}` },
        { status: 403 }
      );
    }

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
