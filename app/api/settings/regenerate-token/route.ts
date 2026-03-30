import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth/session";
import { getClient } from "@/lib/db/client";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function POST() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  try {
    const newToken = randomUUID();
    const prisma = await getClient();

    await prisma.user.update({
      where: { id: session.user.id },
      data: { capture_token: newToken },
    });

    return NextResponse.json({ token: newToken }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to regenerate token" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
