import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "gemini-embedding-001";
const CLASSIFY_MODEL = "gemini-3.1-flash-lite-preview";
const OUTPUT_DIMENSIONALITY = 768;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

// --- Classification result type ---

export interface ClassificationResult {
  ai_summary: string;
  tags: string[];
  category_slugs: string[];
  has_prompt: boolean;
  prompt_text: string | null;
  prompt_type: "image" | "video" | "text" | null;
  confidence: number;
}

export interface TranslationResult {
  language: string | null;
  translated_title: string | null;
  translated_body_text: string | null;
  translated: boolean;
}

const CJK_CHAR_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const HANGUL_CHAR_REGEX = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g;
const LATIN_CHAR_REGEX = /[A-Za-z]/g;
const MAX_TRANSLATION_CHARS_PER_CHUNK = 3500;

function countMatches(value: string, regex: RegExp): number {
  return value.match(regex)?.length || 0;
}

function normalizeLanguageCode(language: string | null | undefined): string | null {
  const code = language?.trim().toLowerCase();
  if (!code) return null;
  if (code === "english") return "en";
  if (code.startsWith("en")) return "en";
  if (code.startsWith("ja")) return "ja";
  if (code.startsWith("ko")) return "ko";
  if (code.startsWith("yue")) return "yue";
  if (code.startsWith("cmn")) return "zh";
  if (code.startsWith("zh")) return "zh";
  return code.slice(0, 8);
}

function inferLanguageFromScript(text: string): string | null {
  const cjkCount = countMatches(text, CJK_CHAR_REGEX);
  const hangulCount = countMatches(text, HANGUL_CHAR_REGEX);

  if (hangulCount >= 4 && hangulCount > cjkCount) return "ko";
  if (cjkCount >= 4) {
    const hasKana = /[\u3040-\u30ff]/.test(text);
    return hasKana ? "ja" : "zh";
  }

  return null;
}

function looksMostlyEnglish(text: string): boolean {
  const latinCount = countMatches(text, LATIN_CHAR_REGEX);
  const cjkCount = countMatches(text, CJK_CHAR_REGEX);
  const hangulCount = countMatches(text, HANGUL_CHAR_REGEX);
  const nonLatinCount = cjkCount + hangulCount;

  if (latinCount === 0) return false;
  if (nonLatinCount === 0) return true;
  return latinCount >= nonLatinCount * 2;
}

function isUsefulTranslation(
  original: string,
  translated: string | null,
  sourceLanguage: string | null
): translated is string {
  const originalText = original.trim();
  const translatedText = translated?.trim();

  if (!translatedText) return false;
  if (!originalText) return false;
  if (translatedText === originalText) return false;

  if (sourceLanguage && sourceLanguage !== "en") {
    const sourceHint = inferLanguageFromScript(originalText);
    const cjkBefore = countMatches(originalText, CJK_CHAR_REGEX) + countMatches(originalText, HANGUL_CHAR_REGEX);
    const cjkAfter = countMatches(translatedText, CJK_CHAR_REGEX) + countMatches(translatedText, HANGUL_CHAR_REGEX);

    if ((sourceHint === "ja" || sourceHint === "zh" || sourceHint === "ko" || sourceLanguage === "yue") && cjkBefore >= 6) {
      if (!looksMostlyEnglish(translatedText)) return false;
      if (cjkAfter >= Math.max(6, Math.floor(cjkBefore * 0.5))) return false;
    }
  }

  return true;
}

function splitIntoTranslationChunks(text: string, maxChars = MAX_TRANSLATION_CHARS_PER_CHUNK): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const chunks: string[] = [];
  let current = "";
  const paragraphs = trimmed.split(/\n{2,}/);

  for (const paragraph of paragraphs) {
    const value = paragraph.trim();
    if (!value) continue;

    if (value.length > maxChars) {
      const lines = value.split("\n");
      for (const line of lines) {
        const candidate = current ? `${current}\n${line}` : line;
        if (candidate.length <= maxChars) {
          current = candidate;
          continue;
        }

        if (current) {
          chunks.push(current);
          current = "";
        }

        if (line.length <= maxChars) {
          current = line;
          continue;
        }

        for (let i = 0; i < line.length; i += maxChars) {
          chunks.push(line.slice(i, i + maxChars));
        }
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${value}` : value;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = value;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function translateChunk(
  genai: GoogleGenAI,
  sourceLanguage: string,
  text: string,
  kind: "title" | "body",
  index: number,
  total: number
): Promise<string | null> {
  const chunkLabel = total > 1 ? `Chunk ${index + 1} of ${total}. ` : "";
  const prompt = `Translate this ${sourceLanguage} ${kind} to natural English. Return ONLY the translated text, nothing else.

${chunkLabel}Rules:
- Translate ALL of the text. Do not summarize, shorten, or omit anything.
- Preserve URLs, @handles, hashtags, cashtags, emoji, and markdown/code fences.
- Preserve paragraph structure and line breaks.
- If a term is already in English, keep it as-is.

${text}`;

  const result = await genai.models.generateContent({
    model: CLASSIFY_MODEL,
    contents: prompt,
    config: {
      temperature: 0.1,
      maxOutputTokens: kind === "title" ? 1200 : 8192,
    },
  });

  return result.text?.trim() || null;
}

/**
 * Unified content classification via Gemini.
 * Single API call produces: summary, tags, categories, and prompt detection.
 */
export async function classifyContent(
  title: string,
  bodyText: string,
  sourceType: string,
  categorySlugs: string[],
  authorHandle?: string | null
): Promise<ClassificationResult> {
  const genai = getClient();
  const truncatedBody = bodyText.slice(0, 2000);
  const categoriesText = categorySlugs.join(", ");

  const prompt = `Analyze this Twitter/X content and classify it.

Content type: ${sourceType}
Author: ${authorHandle || "unknown"}
Title: ${title}
Body: ${truncatedBody}

Available categories (assign 1-3 from this list ONLY):
${categoriesText}

Instructions:
1. Assign 1-3 category slugs from the list above that best match this content
2. Generate 3-8 tags that describe what this content IS ABOUT — the concrete subject matter, tools mentioned, techniques shown, or visual subject of any images. Tags must be specific and useful for filtering a personal library.
   - GOOD tags: "midjourney", "portrait-photography", "stable-diffusion", "react-hooks", "ai-art", "watercolor", "landscape"
   - BAD tags: "growth-marketing", "social-media-strategy", "content-creation", "digital-innovation", "thought-leadership" — these are vague marketing filler that nobody would search for
   - If the content is an image post or AI art, tag the visual subject (e.g. "portrait", "anime", "architecture") and the tool if mentioned
   - If the content is in a foreign language, tag based on the actual topic, not the fact that it's multilingual
3. Write a 1-2 sentence summary for a display card
4. Determine if this content contains an AI IMAGE or VIDEO generation prompt — meaning a prompt specifically used with tools like Midjourney, DALL-E, Stable Diffusion, Flux, Ideogram, Firefly, Sora, Runway, Kling, Seedance, Pika, Luma, etc. to generate visual media.
5. IMPORTANT: Do NOT mark as has_prompt if the content contains:
   - Prompts for text AI assistants (ChatGPT, Claude, Gemini chat, OpenClaw/Clawdbot)
   - Coding prompts or instructions for AI coding tools (Claude Code, Cursor, Copilot)
   - Marketing prompts, business strategy prompts, or content calendar prompts
   - General instructions or tips for using AI tools (unless they include an actual image/video generation prompt)
   - Tweets that merely DISCUSS or REVIEW AI image/video tools without sharing an actual generation prompt
   - Showcase posts that say things like "generated with Midjourney/Flux/Kling/Sora" or "AI-generated image/video" but do NOT include the actual prompt text
6. If it contains an actual image/video generation prompt, extract the prompt text and classify its type as "image" or "video" only
7. Rate your confidence (0.0-1.0) in the prompt detection specifically

Return as JSON with this exact structure:
{
  "category_slugs": ["slug-1", "slug-2"],
  "tags": ["tag-1", "tag-2", "tag-3"],
  "ai_summary": "A concise 1-2 sentence summary.",
  "has_prompt": false,
  "prompt_text": null,
  "prompt_type": null,
  "confidence": 0.85
}`;

  const result = await genai.models.generateContent({
    model: CLASSIFY_MODEL,
    contents: prompt,
  });

  const text = result.text?.trim();
  if (!text) {
    return defaultResult();
  }

  // Extract JSON from response (handle markdown code fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return defaultResult();
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ai_summary: typeof parsed.ai_summary === "string" ? parsed.ai_summary.slice(0, 500) : "",
      tags: Array.isArray(parsed.tags)
        ? parsed.tags
            .filter((t: unknown): t is string => typeof t === "string" && t.length >= 2 && t.length <= 40)
            .map((t: string) => t.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
            .filter((t: string) => t.length >= 2)
        : [],
      category_slugs: Array.isArray(parsed.category_slugs)
        ? parsed.category_slugs.filter((s: unknown): s is string =>
            typeof s === "string" && categorySlugs.includes(s)
          )
        : [],
      has_prompt: !!parsed.has_prompt,
      prompt_text: parsed.has_prompt && typeof parsed.prompt_text === "string" ? parsed.prompt_text : null,
      prompt_type: parsed.has_prompt && ["image", "video"].includes(parsed.prompt_type)
        ? parsed.prompt_type
        : null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch {
    return defaultResult();
  }
}

function defaultResult(): ClassificationResult {
  return {
    ai_summary: "",
    tags: [],
    category_slugs: [],
    has_prompt: false,
    prompt_text: null,
    prompt_type: null,
    confidence: 0,
  };
}

export async function translateToEnglish(
  title: string,
  bodyText: string
): Promise<TranslationResult> {
  const genai = getClient();
  const noResult: TranslationResult = { language: null, translated: false, translated_title: null, translated_body_text: null };

  // Step 1: Detect language (tiny output — won't hit token limits)
  const combinedText = `${title || ""}\n${bodyText || ""}`.trim();
  const scriptHint = inferLanguageFromScript(combinedText);
  const sample = combinedText.slice(0, 1500);
  const detectPrompt = `Detect the primary language of this text. Return ONLY a JSON object like {"language":"ja","is_english":false}. Use lowercase ISO 639-1 when possible. For Cantonese, return "yue". If the text is mixed, choose the language that carries most of the meaning.

Text:
${sample}`;

  const detectResult = await genai.models.generateContent({
    model: CLASSIFY_MODEL,
    contents: detectPrompt,
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      maxOutputTokens: 120,
    },
  });

  const detectText = detectResult.text?.trim();
  if (!detectText) return noResult;

  const detectJson = detectText.match(/\{[\s\S]*\}/);
  if (!detectJson) return noResult;

  let language: string;
  try {
    const parsed = JSON.parse(detectJson[0]);
    const detected = normalizeLanguageCode(typeof parsed.language === "string" ? parsed.language : null);
    language = detected || "en";
    const isEnglish = parsed.is_english === true || parsed.isEnglish === true;

    if ((isEnglish || language === "en") && scriptHint && scriptHint !== "en") {
      language = scriptHint;
    } else if (isEnglish === true || language === "en") {
      return { language: "en", translated: false, translated_title: null, translated_body_text: null };
    }
  } catch {
    return noResult;
  }

  // Step 2: Translate title (separate call, plain text output)
  let translatedTitle: string | null = null;
  if (title && title.length > 0) {
    try {
      translatedTitle = await translateChunk(genai, language, title.slice(0, 1000), "title", 0, 1);
    } catch {
      // Title translation failed, continue with body
    }
  }

  // Step 3: Translate body (separate call, plain text output — no JSON wrapper means no output limit issues)
  let translatedBody: string | null = null;
  if (bodyText && bodyText.length > 0) {
    try {
      const chunks = splitIntoTranslationChunks(bodyText.slice(0, 30000));
      const translatedChunks: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const translatedChunk = await translateChunk(genai, language, chunks[i], "body", i, chunks.length);
        if (!translatedChunk) {
          translatedChunks.length = 0;
          break;
        }
        translatedChunks.push(translatedChunk);
      }

      translatedBody = translatedChunks.length > 0 ? translatedChunks.join("\n\n").trim() : null;
    } catch {
      // Body translation failed
    }
  }

  const usefulTitle = isUsefulTranslation(title, translatedTitle, language) ? translatedTitle!.trim() : null;
  const usefulBody = isUsefulTranslation(bodyText, translatedBody, language) ? translatedBody!.trim() : null;
  const hasTranslation = !!(usefulTitle || usefulBody);
  return {
    language,
    translated: hasTranslation,
    translated_title: usefulTitle ? usefulTitle.slice(0, 2000) : null,
    translated_body_text: usefulBody ? usefulBody.slice(0, 60000) : null,
  };
}

// --- Image description via Gemini Vision ---

export interface ImageDescription {
  alt_text: string;
  ai_description: string;
}

/**
 * Describe an image using Gemini Vision.
 * Takes a URL to the image (can be local proxy or remote).
 */
export async function describeImage(imageUrl: string): Promise<ImageDescription> {
  const genai = getClient();

  // Fetch image as base64
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const contentType = response.headers.get("content-type") || "image/jpeg";

  const result = await genai.models.generateContent({
    model: CLASSIFY_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: contentType,
              data: base64,
            },
          },
          {
            text: `Describe this image. Return JSON with:
- "alt_text": A short 1-sentence accessibility description
- "ai_description": A detailed 2-3 sentence description of what's shown

Return ONLY JSON: {"alt_text": "...", "ai_description": "..."}`,
          },
        ],
      },
    ],
  });

  const text = result.text?.trim();
  if (!text) return { alt_text: "", ai_description: "" };

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { alt_text: "", ai_description: "" };

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      alt_text: typeof parsed.alt_text === "string" ? parsed.alt_text.slice(0, 300) : "",
      ai_description: typeof parsed.ai_description === "string" ? parsed.ai_description.slice(0, 1000) : "",
    };
  } catch {
    return { alt_text: "", ai_description: "" };
  }
}

// --- Legacy wrapper for backward compat ---

export async function generateTags(
  title: string,
  bodyText: string,
  sourceType: string,
  authorHandle?: string | null
): Promise<string[]> {
  const result = await classifyContent(title, bodyText, sourceType, [], authorHandle);
  return result.tags;
}

// --- Embeddings ---

export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([text]);
  return embeddings[0];
}

export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const genai = getClient();
  const result = await genai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
    config: { outputDimensionality: OUTPUT_DIMENSIONALITY },
  });

  if (!result.embeddings) {
    throw new Error("No embeddings returned from Gemini API");
  }

  return result.embeddings.map((e) => {
    if (!e.values) {
      throw new Error("Embedding values are missing");
    }
    return e.values;
  });
}
