import { describe, expect, it } from "vitest";
import { hasExplicitPromptSnippet, isLikelyVisualPromptText } from "@/lib/visual-prompt";

describe("hasExplicitPromptSnippet", () => {
  it("detects shared prompt text", () => {
    expect(
      hasExplicitPromptSnippet(
        "Prompt: cinematic portrait of a desert traveler, golden hour, dust in the air, 85mm, photorealistic",
      ),
    ).toBe(true);
  });

  it("ignores short non-prompts", () => {
    expect(hasExplicitPromptSnippet("prompt: link in bio")).toBe(false);
  });
});

describe("isLikelyVisualPromptText", () => {
  it("accepts prompt-like visual descriptions", () => {
    expect(
      isLikelyVisualPromptText(
        "surreal chrome tiger in neon Tokyo alley, volumetric fog, cinematic lighting, 35mm, photorealistic",
      ),
    ).toBe(true);
  });

  it("rejects discussion-oriented AI text", () => {
    expect(
      isLikelyVisualPromptText(
        "A ranked list of the fastest-growing GitHub repositories focused on AI agents and open-source tooling this month.",
      ),
    ).toBe(false);
  });
});
