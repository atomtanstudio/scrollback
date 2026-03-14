import { describe, expect, it } from "vitest";
import { classifySourceType } from "@/lib/content-classifier";

describe("classifySourceType", () => {
  it("keeps showcase posts as tweets when they do not share the prompt", () => {
    const result = classifySourceType(
      "Fastest growing AI projects this month. AI-generated infographic made with Midjourney.",
      ["https://example.com/image.jpg"],
      false,
      false,
      false,
    );

    expect(result).toBe("tweet");
  });

  it("classifies art showcase posts with tool context even without a stored prompt", () => {
    const result = classifySourceType(
      "Golden hour and a gentle breeze. Made with Gemini Nano Banana.",
      ["https://example.com/image.jpg"],
      false,
      false,
      false,
    );

    expect(result).toBe("image_prompt");
  });

  it("classifies Midjourney style reference posts as image_prompt", () => {
    const result = classifySourceType(
      "New Midjourney Style Reference. Unlock with --sref 2678582728.",
      ["https://example.com/image.jpg"],
      false,
      false,
      false,
    );

    expect(result).toBe("image_prompt");
  });

  it("classifies explicit image prompt posts as image_prompt", () => {
    const result = classifySourceType(
      "Image prompt: surreal chrome tiger walking through neon Tokyo alley, volumetric fog, cinematic lighting, 35mm",
      ["https://example.com/image.jpg"],
      false,
      false,
      false,
    );

    expect(result).toBe("image_prompt");
  });

  it("classifies explicit video prompt posts as video_prompt", () => {
    const result = classifySourceType(
      "Here's the prompt I used: cinematic drone flythrough of a brutalist temple at sunrise, soft mist, ultra detailed. Made in Kling.",
      ["https://example.com/video.mp4"],
      true,
      false,
      false,
    );

    expect(result).toBe("video_prompt");
  });

  it("classifies strong Midjourney parameter syntax as image_prompt", () => {
    const result = classifySourceType(
      "/imagine a raven knight standing in snow --ar 3:4 --stylize 600",
      ["https://example.com/image.jpg"],
      false,
      false,
      false,
    );

    expect(result).toBe("image_prompt");
  });
});
