import { describe, expect, it } from "vitest";
import { getPromptPreview } from "@/lib/prompt-preview";

describe("getPromptPreview", () => {
  it("detects obvious image prompts in media alt text", () => {
    const preview = getPromptPreview(
      "Image prompt: cinematic portrait of a woman in golden-hour rain, shot on 85mm, soft rim light, ultra detailed, --ar 3:4",
      "image"
    );

    expect(preview?.label).toBe("Image Prompt");
    expect(preview?.preview).toContain("Image prompt");
  });

  it("detects obvious video prompts for motion media", () => {
    const preview = getPromptPreview(
      "Video prompt: neon alley chase scene, dramatic camera move, rain particles, slow dolly-in, 24fps, runway gen-4",
      "video"
    );

    expect(preview?.label).toBe("Video Prompt");
  });

  it("ignores regular descriptive alt text", () => {
    const preview = getPromptPreview(
      "A collage of four whimsical AI-generated illustrations showing famous movie casts taking a selfie in a bathroom mirror.",
      "image"
    );

    expect(preview).toBeNull();
  });
});
