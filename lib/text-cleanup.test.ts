import { describe, expect, it } from "vitest";

import { normalizeCapturedText } from "@/lib/text-cleanup";
import { parseBodyContent } from "@/lib/content-parser";

describe("normalizeCapturedText", () => {
  it("removes orphan leading variation selectors", () => {
    expect(normalizeCapturedText("\uFE0FHello world")).toBe("Hello world");
  });

  it("removes variation selectors stranded before whitespace", () => {
    expect(normalizeCapturedText("Prompt quality\uFE0F test")).toBe("Prompt quality test");
  });

  it("preserves ordinary text", () => {
    expect(normalizeCapturedText("A normal capture body")).toBe("A normal capture body");
  });
});

describe("parseBodyContent", () => {
  it("uses cleaned text for plain body segments", () => {
    const parsed = parseBodyContent("\uFE0F一个工程级测试提示词");

    expect(parsed.segments).toEqual([
      { type: "text", content: "一个工程级测试提示词" },
    ]);
  });
});
