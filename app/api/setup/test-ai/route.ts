import { NextRequest, NextResponse } from "next/server";
import { sanitizeErrorMessage } from "@/lib/security/redact";
import { requireSetupUnlocked } from "@/lib/setup/guard";

type Provider = "gemini" | "openai";

async function testGemini(apiKey: string): Promise<void> {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text: "test" }] },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API returned ${res.status}`);
  }
}

async function testOpenAI(apiKey: string): Promise<void> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: "test",
      dimensions: 768,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI API returned ${res.status}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const locked = await requireSetupUnlocked({ allowAdmin: true });
    if (locked) return locked;

    const { apiKey, provider } = await request.json();
    const selectedProvider: Provider =
      provider === "openai" ? "openai" : "gemini";

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { success: false, error: "API key is required" },
        { status: 400 }
      );
    }

    if (selectedProvider === "openai") {
      await testOpenAI(apiKey);
    } else {
      await testGemini(apiKey);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: sanitizeErrorMessage(error, "Test failed"),
      },
      { status: 500 }
    );
  }
}
