import { describe, expect, it } from "vitest";

import { needsRetranslation, originalLooksLikeForeignText } from "@/lib/translation-backfill";

describe("translation backfill heuristics", () => {
  it("flags CJK items with no stored language when the body is clearly foreign", () => {
    expect(
      needsRetranslation({
        language: null,
        title: null,
        body_text: "这是一个测试段落",
        translated_body_text: null,
      })
    ).toBe(true);
  });

  it("flags mixed or partial CJK translations", () => {
    expect(
      needsRetranslation({
        language: "zh",
        title: null,
        body_text: "这是第一段。\n\n这是第二段。",
        translated_body_text: "This is the first paragraph.\n\n这是第二段。",
      })
    ).toBe(true);
  });

  it("does not flag clearly English translations", () => {
    expect(
      needsRetranslation({
        language: "ja",
        title: "見出し",
        translated_title: "Headline",
        body_text: "これは本文です。",
        translated_body_text: "This is the body text.",
      })
    ).toBe(false);
  });

  it("detects obviously foreign source text", () => {
    expect(originalLooksLikeForeignText("", "こんにちは世界")).toBe(true);
    expect(originalLooksLikeForeignText("", "hello world")).toBe(false);
  });
});
