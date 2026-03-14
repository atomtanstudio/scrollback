import { NextRequest, NextResponse } from "next/server";
import { createInitialAdmin } from "@/lib/auth/bootstrap";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: "Email and password (min 8 chars) required" },
        { status: 400 }
      );
    }

    await createInitialAdmin(email, password);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin setup error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Setup failed" },
      { status: 500 }
    );
  }
}
