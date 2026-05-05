import { describe, expect, it } from "vitest";
import { redactSensitiveText, sanitizeErrorMessage } from "@/lib/security/redact";

describe("redactSensitiveText", () => {
  it("redacts credentials embedded in database URLs", () => {
    expect(
      redactSensitiveText("postgresql://alice:super-secret@example.com:5432/scrollback")
    ).toBe("postgresql://[redacted]:[redacted]@example.com:5432/scrollback");
  });

  it("redacts key-like query params and bearer tokens", () => {
    expect(
      redactSensitiveText(
        "https://example.com/test?key=abc123 Authorization: Bearer token-123"
      )
    ).toBe("https://example.com/test?key=[redacted] Authorization: Bearer [redacted]");
  });

  it("redacts labelled secrets and env assignments", () => {
    expect(
      redactSensitiveText(
        "GEMINI_API_KEY=abc OPENAI_API_KEY=sk-test token: xyz password=\"hunter2\""
      )
    ).toBe("GEMINI_API_KEY=[redacted] OPENAI_API_KEY=[redacted] token: [redacted] password=\"[redacted]\"");
  });

  it("leaves non-sensitive text untouched", () => {
    expect(redactSensitiveText("Connection failed")).toBe("Connection failed");
  });
});

describe("sanitizeErrorMessage", () => {
  it("falls back safely for unknown errors", () => {
    expect(sanitizeErrorMessage(null, "Fallback")).toBe("Fallback");
  });
});
