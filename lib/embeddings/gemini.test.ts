import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent,
    };
  },
}));

describe("translateToEnglish", () => {
  beforeEach(() => {
    generateContent.mockReset();
    vi.resetModules();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("uses script hints when language detection incorrectly says English", async () => {
    generateContent
      .mockResolvedValueOnce({ text: '{"language":"en","is_english":true}' })
      .mockResolvedValueOnce({ text: "Hello world" });

    const { translateToEnglish } = await import("./gemini");
    const result = await translateToEnglish("", "你好世界");

    expect(result.language).toBe("zh");
    expect(result.translated).toBe(true);
    expect(result.translated_body_text).toBe("Hello world");
  });

  it("rejects untranslated passthrough for CJK content", async () => {
    generateContent
      .mockResolvedValueOnce({ text: '{"language":"ja","is_english":false}' })
      .mockResolvedValueOnce({ text: "これは翻訳されていません" });

    const { translateToEnglish } = await import("./gemini");
    const result = await translateToEnglish("", "これは翻訳されていません");

    expect(result.language).toBe("ja");
    expect(result.translated).toBe(false);
    expect(result.translated_body_text).toBeNull();
  });

  it("chunks long bodies so the full text can be translated", async () => {
    const paragraphA = "第一段。".repeat(800);
    const paragraphB = "第二段。".repeat(800);
    const body = `${paragraphA}\n\n${paragraphB}`;

    generateContent
      .mockResolvedValueOnce({ text: '{"language":"zh","is_english":false}' })
      .mockResolvedValueOnce({ text: "First translated chunk." })
      .mockResolvedValueOnce({ text: "Second translated chunk." });

    const { translateToEnglish } = await import("./gemini");
    const result = await translateToEnglish("", body);

    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(result.translated).toBe(true);
    expect(result.translated_body_text).toBe("First translated chunk.\n\nSecond translated chunk.");
  });
});
