import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { success: false, error: "API key is required" },
        { status: 400 }
      );
    }

    // Test with a minimal embedding call
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: "test" }] },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message =
        err?.error?.message || `API returned ${res.status}`;
      return NextResponse.json({ success: false, error: message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Test failed",
      },
      { status: 500 }
    );
  }
}
