import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getClient } from "@/lib/db/client";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function POST() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const prisma = await getClient();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { capture_token: true },
  });

  if (!user?.capture_token) {
    return NextResponse.json(
      { error: "No capture token configured" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json({ token: user.capture_token }, { headers: NO_STORE_HEADERS });
}
