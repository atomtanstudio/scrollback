import { describe, expect, it } from "vitest";
import { qualifiesAsArtCapture } from "@/lib/art-detection";

describe("qualifiesAsArtCapture", () => {
  it("rejects text prompts even when they mention image generation", () => {
    expect(
      qualifiesAsArtCapture({
        title: "How to Create Stunning Websites Using AI Tools",
        bodyText: "Prompt for building a landing page in Next.js.",
        promptText: "Build me a SaaS landing page with Tailwind.",
        promptType: "text",
      }),
    ).toBe(false);
  });

  it("keeps AI art showcase posts without extracted prompts", () => {
    expect(
      qualifiesAsArtCapture({
        title: "Golden hour and a gentle breeze.",
        bodyText: "Made with Gemini Nano Banana.",
        promptText: null,
        promptType: null,
      }),
    ).toBe(true);
  });

  it("keeps Midjourney style reference posts when body text provides context", () => {
    expect(
      qualifiesAsArtCapture({
        title: "New Midjourney Style Reference",
        bodyText: "Unlock with --sref 2678582728 and create cinematic portraits.",
        promptText: "--sref 2678582728",
        promptType: "image",
      }),
    ).toBe(true);
  });

  it("keeps bare sref prompts when the post is clearly a style-reference share", () => {
    expect(
      qualifiesAsArtCapture({
        title: "A SREF with gritty urban detail",
        bodyText: "Style reference share for a comic look.",
        promptText: "--sref 1169476906",
        promptType: "image",
      }),
    ).toBe(true);
  });

  it("keeps art posts whose prompt is only captured as a URL", () => {
    expect(
      qualifiesAsArtCapture({
        title: "Golden hour grace",
        bodyText: "Made with Gemini Nano Banana.",
        promptText: "https://twitter.com/example/status/123/photo/1",
        promptType: "image",
      }),
    ).toBe(true);
  });

  it("keeps art posts whose prompt lives in ALT text", () => {
    expect(
      qualifiesAsArtCapture({
        title: "Not real, AI, but generated in Midjourney and edited with Nano Banana Pro",
        bodyText: "Prompt in ALT.",
        promptText: "Prompt in ALT",
        promptType: "image",
      }),
    ).toBe(true);
  });

  it("keeps short visual prompt collections when the prompt is clearly image-oriented", () => {
    expect(
      qualifiesAsArtCapture({
        title: "Portrait prompt collection",
        bodyText: "Copy & paste to get atmospheric results.",
        promptText: "hot, realistic portrait photography",
        promptType: "image",
        mediaAltText: "A screenshot of a website gallery showing multiple portraits of various women.",
      }),
    ).toBe(true);
  });

  it("keeps url-only prompts when the post is a prompt share with visual art media", () => {
    expect(
      qualifiesAsArtCapture({
        title: "Nano Banana Pro - 3x3 photo grid",
        bodyText: "Prompt: https://twitter.com/example/status/123/photo/1",
        promptText: "https://twitter.com/example/status/123/photo/1",
        promptType: "image",
        mediaAltText: "A grid of nine photographs showing a young woman making various playful facial expressions.",
      }),
    ).toBe(true);
  });

  it("keeps image-edit and translation prompts when the output is clearly visual art", () => {
    expect(
      qualifiesAsArtCapture({
        title: "Face Swap solutions",
        bodyText: "Prompt below",
        promptText: "faceswap : replace the face of the character in the first image by the face in the second image.",
        promptType: "image",
        mediaAltText: "A workflow output showing a character with swapped facial features.",
      }),
    ).toBe(true);

    expect(
      qualifiesAsArtCapture({
        title: "Comic text translation and colorization",
        bodyText: "Nano Banana 2 example with prompt.",
        promptText: "将这张图里的日文替换成翻译后的简体中文，然后为这张漫画进行上色",
        promptType: "image",
        mediaAltText: "A manga panel and an anime-style illustration of two schoolgirls in a hallway.",
      }),
    ).toBe(true);
  });

  it("rejects screenshot-like content without art context", () => {
    expect(
      qualifiesAsArtCapture({
        title: "Fastest growing AI projects this month",
        bodyText: "AI-generated infographic made with Midjourney.",
        mediaAltText: "An infographic listing the top ten fastest-growing GitHub repositories.",
        promptText: null,
        promptType: null,
      }),
    ).toBe(false);
  });

  it("rejects dataset and guide roundup posts", () => {
    expect(
      qualifiesAsArtCapture({
        title: "Dataset for consistent identity preservation in image editing",
        bodyText: "A new dataset and benchmark for image editing research.",
      }),
    ).toBe(false);

    expect(
      qualifiesAsArtCapture({
        title: "all the guides you need for ai content in 2026",
        bodyText: "A roundup of guides and frameworks.",
      }),
    ).toBe(false);
    expect(
      qualifiesAsArtCapture({
        title: "Thread by Dominik Scholz (238 tweets)",
        bodyText: "Thread by Dominik Scholz.",
      }),
    ).toBe(false);
  });

  it("keeps concrete visual prompts for people and scenes", () => {
    expect(
      qualifiesAsArtCapture({
        title: "Portrait prompt",
        bodyText: "Generated with Grok.",
        promptText: "hot, realistic portrait photography of a woman holding my product on a beach",
        promptType: "image",
      }),
    ).toBe(true);

    expect(
      qualifiesAsArtCapture({
        title: "Face swap workflow",
        bodyText: "Nano Banana face swap example.",
        promptText: "replace the face of the character in the first image with the face in the second image",
        promptType: "image",
      }),
    ).toBe(true);
  });

  it("rejects meta and tutorial prompts even when they mention image tools", () => {
    expect(
      qualifiesAsArtCapture({
        title: "Nano Banana Pro effective prompts 20-pack",
        bodyText: "A prompt structure guide for better outputs.",
        promptText: "20 effective prompts for Nano Banana Pro",
        promptType: "image",
      }),
    ).toBe(false);

    expect(
      qualifiesAsArtCapture({
        title: "Comic translation system",
        bodyText: "Prompt engineering example.",
        promptText: "Role: manga translation assistant. Task: colorize the panel and preserve the bubbles.",
        promptType: "image",
      }),
    ).toBe(false);

    expect(
      qualifiesAsArtCapture({
        title: "Website icons trick",
        bodyText: "Use logos and icons on your website.",
        promptText: "generate moving website icons for the landing page",
        promptType: "image",
      }),
    ).toBe(false);
  });

  it("keeps structured visual specs for concrete image outputs", () => {
    expect(
      qualifiesAsArtCapture({
        title: "Professional headshot prompt",
        promptText:
          "Task: Generate a High-End Professional Headshot. Wardrobe: tailored blazer. Lighting: Rembrandt studio lighting. Background: soft gradient gray. Expression: confident and approachable.",
        promptType: "image",
      }),
    ).toBe(true);

    expect(
      qualifiesAsArtCapture({
        title: "Poster prompt",
        promptText:
          "poster_structure: classic magazine cover grid. title_layer: GOOD MORNING. subject_layer: foreground cutout. barcode at bottom right. background with paper grain.",
        promptType: "image",
      }),
    ).toBe(true);

    expect(
      qualifiesAsArtCapture({
        title: "Style transfer prompt",
        promptText:
          "task: edit-image: convert-art-style target_style: line-art style_settings: watercolor, sumi-e, figure-render",
        promptType: "image",
      }),
    ).toBe(true);

    expect(
      qualifiesAsArtCapture({
        title: "Computational Selfie Realism Architect",
        promptText:
          "SYSTEM PROMPT v4 — Computational Selfie Realism Architect. You are a computational-photography prompt architect for photorealistic selfies. framing_and_perspective: lens_equiv_mm 26. lighting_and_exposure: failure_modes_active. computational_pipeline: denoise smear and compression.",
        promptType: "image",
      }),
    ).toBe(true);
  });

  it("rejects structured system prompts that are not specific visual outputs", () => {
    expect(
      qualifiesAsArtCapture({
        title: "Aesthetic Bridge",
        promptText:
          "system prompt: identity: name: Aesthetic Bridge: MJ-to-Gemini role: Cross-Architecture Image Translation Specialist architectural_context: source_model: Midjourney target_model: Nano Banana operational_workflow: response_template:",
        promptType: "image",
      }),
    ).toBe(false);
  });
});
