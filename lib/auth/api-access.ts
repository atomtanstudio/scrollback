import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { validateCaptureSecret } from "@/lib/auth/capture-secret";

export type ApiAccess =
  | { ok: true; userId: string; authMethod: "session" | "token" }
  | { ok: false; response: NextResponse };

export async function requireApiAccess(request: NextRequest): Promise<ApiAccess> {
  const session = await auth();
  if (session?.user?.id) {
    return { ok: true, userId: session.user.id, authMethod: "session" };
  }

  const tokenAuth = await validateCaptureSecret(request);
  if (tokenAuth.valid && tokenAuth.userId) {
    return { ok: true, userId: tokenAuth.userId, authMethod: "token" };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: tokenAuth.error || "Unauthorized" },
      { status: 401 }
    ),
  };
}

