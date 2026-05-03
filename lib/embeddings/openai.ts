import type {
  ClassificationResult,
  ImageDescription,
  TranslationResult,
} from "./gemini";
import type { CategoryOption } from "@/lib/default-categories";
import { safeFetch } from "@/lib/security/safe-fetch";
import { getConfig } from "@/lib/config";

const RESPONSES_MODEL = process.env.OPENAI_RESPONSES_MODEL || "gpt-5-nano";
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const OUTPUT_DIMENSIONALITY = 768;

function getApiKey(): string {
  const config = getConfig();
  const apiKey =
    process.env.OPENAI_API_KEY ||
    (config?.embeddings?.provider === "openai" ? config.embeddings.apiKey : undefined);
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  return apiKey;
}

async function openaiFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message =
      err?.error?.message || err?.message || `OpenAI API returned ${res.status}`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

function extractOutputText(response: { output_text?: string; output?: unknown[] }): string {
  if (typeof response.output_text === "string") return response.output_text;

  const chunks: string[] = [];
  for (const item of response.output || []) {
    const content = (item as { content?: unknown[] }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") chunks.push(text);
    }
  }
  return chunks.join("\n").trim();
}

async function generateText(prompt: string, jsonSchema?: Record<string, unknown>): Promise<string> {
  const response = await openaiFetch<{ output_text?: string; output?: unknown[] }>(
    "responses",
    {
      model: RESPONSES_MODEL,
      input: prompt,
      text: jsonSchema
        ? {
            format: {
              type: "json_schema",
              name: "feedsilo_result",
              schema: jsonSchema,
              strict: false,
            },
          }
        : undefined,
    }
  );

  return extractOutputText(response).trim();
}

function extractJson(text: string): unknown | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function defaultClassification(): ClassificationResult {
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

export async function classifyContent(
  title: string,
  bodyText: string,
  sourceType: string,
  categoryOptions: CategoryOption[],
  authorHandle?: string | null
): Promise<ClassificationResult> {
  const truncatedBody = bodyText.slice(0, 2000);
  const categorySlugs = categoryOptions.map((category) => category.slug);
  const categoriesText = categoryOptions
    .map((category) => {
      const details = [category.name, category.description].filter(Boolean).join(" - ");
      return details ? `- ${category.slug}: ${details}` : `- ${category.slug}`;
    })
    .join("\n");

  const prompt = `Analyze this Twitter/X content and classify it.

Content type: ${sourceType}
Author: ${authorHandle || "unknown"}
Title: ${title}
Body: ${truncatedBody}

Available categories (assign 1-3 category slugs from this list ONLY):
${categoriesText}

Instructions:
1. Assign 1-3 category slugs from the list above that best match this content.
2. Generate 3-8 specific lowercase tags that describe the concrete subject matter, tools, techniques, or visual subject.
3. Write a concise 1-2 sentence summary for a display card.
4. Determine if this content contains an AI image or video generation prompt.
5. Do not mark prompts for text assistants, coding tools, marketing workflows, general AI tips, or showcase-only posts as visual prompts.
6. If it contains an actual image/video generation prompt, extract the prompt text and classify its type as "image" or "video" only.
7. Rate confidence from 0 to 1.

Return only JSON with category_slugs, tags, ai_summary, has_prompt, prompt_text, prompt_type, and confidence.`;

  const text = await generateText(prompt, {
    type: "object",
    properties: {
      category_slugs: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
      ai_summary: { type: "string" },
      has_prompt: { type: "boolean" },
      prompt_text: { type: ["string", "null"] },
      prompt_type: { type: ["string", "null"] },
      confidence: { type: "number" },
    },
    required: ["category_slugs", "tags", "ai_summary", "has_prompt", "prompt_text", "prompt_type", "confidence"],
    additionalProperties: false,
  });

  const parsed = extractJson(text) as Record<string, unknown> | null;
  if (!parsed) return defaultClassification();

  return {
    ai_summary:
      typeof parsed.ai_summary === "string" ? parsed.ai_summary.slice(0, 500) : "",
    tags: Array.isArray(parsed.tags)
      ? parsed.tags
          .filter((tag): tag is string => typeof tag === "string" && tag.length >= 2 && tag.length <= 40)
          .map((tag) => tag.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
          .filter((tag) => tag.length >= 2)
      : [],
    category_slugs: Array.isArray(parsed.category_slugs)
      ? parsed.category_slugs.filter(
          (slug): slug is string => typeof slug === "string" && categorySlugs.includes(slug)
        )
      : [],
    has_prompt: parsed.has_prompt === true,
    prompt_text:
      parsed.has_prompt === true && typeof parsed.prompt_text === "string"
        ? parsed.prompt_text
        : null,
    prompt_type:
      parsed.has_prompt === true && (parsed.prompt_type === "image" || parsed.prompt_type === "video")
        ? parsed.prompt_type
        : null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
  };
}

export async function translateToEnglish(
  title: string,
  bodyText: string
): Promise<TranslationResult> {
  const combinedText = `${title || ""}\n${bodyText || ""}`.trim();
  if (!combinedText) {
    return { language: null, translated: false, translated_title: null, translated_body_text: null };
  }

  const text = await generateText(`Detect whether this text is already primarily English. If not, translate it to natural English while preserving URLs, handles, hashtags, code, emoji, and paragraph breaks.

Return only JSON: {"language":"en","is_english":true,"translated_title":null,"translated_body_text":null}

Title:
${title.slice(0, 1000)}

Body:
${bodyText.slice(0, 12000)}`, {
    type: "object",
    properties: {
      language: { type: ["string", "null"] },
      is_english: { type: "boolean" },
      translated_title: { type: ["string", "null"] },
      translated_body_text: { type: ["string", "null"] },
    },
    required: ["language", "is_english", "translated_title", "translated_body_text"],
    additionalProperties: false,
  });

  const parsed = extractJson(text) as Record<string, unknown> | null;
  if (!parsed) {
    return { language: null, translated: false, translated_title: null, translated_body_text: null };
  }

  const translatedTitle =
    typeof parsed.translated_title === "string" && parsed.translated_title.trim()
      ? parsed.translated_title.trim()
      : null;
  const translatedBody =
    typeof parsed.translated_body_text === "string" && parsed.translated_body_text.trim()
      ? parsed.translated_body_text.trim()
      : null;

  return {
    language: typeof parsed.language === "string" ? parsed.language.slice(0, 8) : null,
    translated: !!(translatedTitle || translatedBody),
    translated_title: translatedTitle ? translatedTitle.slice(0, 2000) : null,
    translated_body_text: translatedBody ? translatedBody.slice(0, 60000) : null,
  };
}

export async function describeImage(imageUrl: string): Promise<ImageDescription> {
  const response = await safeFetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const dataUrl = `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;

  const apiResponse = await openaiFetch<{ output_text?: string; output?: unknown[] }>(
    "responses",
    {
      model: RESPONSES_MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_image", image_url: dataUrl },
            {
              type: "input_text",
              text: `Describe this image. Return only JSON: {"alt_text":"short accessibility description","ai_description":"detailed 2-3 sentence description"}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "image_description",
          schema: {
            type: "object",
            properties: {
              alt_text: { type: "string" },
              ai_description: { type: "string" },
            },
            required: ["alt_text", "ai_description"],
            additionalProperties: false,
          },
          strict: false,
        },
      },
    }
  );

  const parsed = extractJson(extractOutputText(apiResponse)) as Record<string, unknown> | null;
  return {
    alt_text: typeof parsed?.alt_text === "string" ? parsed.alt_text.slice(0, 300) : "",
    ai_description:
      typeof parsed?.ai_description === "string" ? parsed.ai_description.slice(0, 1000) : "",
  };
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([text]);
  return embeddings[0];
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return generateEmbeddingsWithDimensions(texts, OUTPUT_DIMENSIONALITY);
}

export async function generateEmbeddingsWithDimensions(
  texts: string[],
  dimensions: 768 | 1536 = OUTPUT_DIMENSIONALITY
): Promise<number[][]> {
  const response = await openaiFetch<{
    data?: Array<{ embedding?: number[]; index?: number }>;
  }>("embeddings", {
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions,
  });

  if (!response.data) throw new Error("No embeddings returned from OpenAI API");
  return response.data
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((item) => {
      if (!item.embedding) throw new Error("Embedding values are missing");
      return item.embedding;
    });
}
