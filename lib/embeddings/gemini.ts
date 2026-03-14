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
2. Generate 3-8 descriptive tags (lowercase, hyphenated if multi-word)
3. Write a 1-2 sentence summary for a display card
4. Determine if this content contains an AI IMAGE or VIDEO generation prompt — meaning a prompt specifically used with tools like Midjourney, DALL-E, Stable Diffusion, Flux, Ideogram, Firefly, Sora, Runway, Kling, Seedance, Pika, Luma, etc. to generate visual media.
5. IMPORTANT: Do NOT mark as has_prompt if the content contains:
   - Prompts for text AI assistants (ChatGPT, Claude, Gemini chat, OpenClaw/Clawdbot)
   - Coding prompts or instructions for AI coding tools (Claude Code, Cursor, Copilot)
   - Marketing prompts, business strategy prompts, or content calendar prompts
   - General instructions or tips for using AI tools (unless they include an actual image/video generation prompt)
   - Tweets that merely DISCUSS or REVIEW AI image/video tools without sharing an actual generation prompt
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
