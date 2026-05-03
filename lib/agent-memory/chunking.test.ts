import { describe, expect, it } from "vitest";
import { buildAgentMemoryChunks, chunkText } from "./chunking";

describe("agent memory chunking", () => {
  it("keeps short text as a single normalized chunk", () => {
    expect(chunkText("One   two\n\n\nthree")).toEqual(["One two\n\nthree"]);
  });

  it("splits long text with bounded chunks", () => {
    const text = Array.from({ length: 80 }, (_, i) => `Sentence ${i}.`).join(" ");
    const chunks = chunkText(text, 120, 20);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 140)).toBe(true);
  });

  it("builds body, prompt, and media chunks from a source item", () => {
    const chunks = buildAgentMemoryChunks({
      id: "item-1",
      user_id: "user-1",
      source_type: "thread",
      source_platform: "x",
      title: "Original",
      body_text: "Body",
      translated_title: "Translated",
      translated_body_text: "Translated body",
      ai_summary: "Summary",
      prompt_text: "A cinematic prompt",
      author_handle: "alice",
      author_display_name: "Alice",
      original_url: "https://example.com",
      posted_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-02T00:00:00.000Z",
      content_hash: "hash",
      tags: ["agents"],
      categories: ["AI Agents"],
      media_descriptions: ["A diagram"],
    });

    expect(chunks.map((chunk) => chunk.chunk_kind)).toEqual(["body", "prompt", "media"]);
    expect(chunks[0].chunk_text).toContain("Translated body");
    expect(chunks[1].chunk_text).toContain("A cinematic prompt");
    expect(chunks[2].chunk_text).toContain("A diagram");
  });
});
