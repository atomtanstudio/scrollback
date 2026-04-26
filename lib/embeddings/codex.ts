import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type {
  ClassificationResult,
  ImageDescription,
  TranslationResult,
} from "./gemini";
import type { CategoryOption } from "@/lib/default-categories";
import { safeFetch } from "@/lib/security/safe-fetch";

const execFileAsync = promisify(execFile);
const CODEX_BIN =
  process.env.CODEX_BIN || "/Applications/Codex.app/Contents/Resources/codex";
const CODEX_MODEL = process.env.FEEDSILO_CODEX_MODEL || "gpt-5.5";

export async function isCodexAuthConfigured(): Promise<boolean> {
  try {
    const raw = await fs.readFile(path.join(os.homedir(), ".codex", "auth.json"), "utf8");
    const auth = JSON.parse(raw);
    return !!auth?.tokens?.access_token;
  } catch {
    return false;
  }
}

async function runCodexJson<T>(
  prompt: string,
  schema: Record<string, unknown>,
  imagePath?: string
): Promise<T> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "feedsilo-codex-"));
  const outputPath = path.join(tmpDir, "response.json");
  const schemaPath = path.join(tmpDir, "schema.json");

  try {
    await fs.writeFile(schemaPath, JSON.stringify(schema), "utf8");
    const args = [
      "exec",
      "--ephemeral",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--model",
      CODEX_MODEL,
      "--output-schema",
      schemaPath,
      "--output-last-message",
      outputPath,
    ];
    if (imagePath) args.push("--image", imagePath);
    args.push(prompt);

    await execFileAsync(CODEX_BIN, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: `/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:${process.env.PATH || ""}`,
      },
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10,
    });

    const output = (await fs.readFile(outputPath, "utf8")).trim();
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Codex did not return JSON");
    return JSON.parse(jsonMatch[0]) as T;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

function classificationSchema(categorySlugs: string[]): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      category_slugs: {
        type: "array",
        items: { type: "string", enum: categorySlugs.length ? categorySlugs : undefined },
      },
      tags: { type: "array", items: { type: "string" } },
      ai_summary: { type: "string" },
      has_prompt: { type: "boolean" },
      prompt_text: { type: ["string", "null"] },
      prompt_type: { type: ["string", "null"], enum: ["image", "video", "text", null] },
      confidence: { type: "number" },
    },
    required: [
      "category_slugs",
      "tags",
      "ai_summary",
      "has_prompt",
      "prompt_text",
      "prompt_type",
      "confidence",
    ],
  };
}

export async function classifyContent(
  title: string,
  bodyText: string,
  sourceType: string,
  categoryOptions: CategoryOption[],
  authorHandle?: string | null
): Promise<ClassificationResult> {
  const categorySlugs = categoryOptions.map((category) => category.slug);
  const categoriesText = categoryOptions
    .map((category) => {
      const details = [category.name, category.description].filter(Boolean).join(" - ");
      return details ? `- ${category.slug}: ${details}` : `- ${category.slug}`;
    })
    .join("\n");

  const result = await runCodexJson<ClassificationResult>(
    `You are classifying a FeedSilo saved item. Return only JSON matching the schema.

Content type: ${sourceType}
Author: ${authorHandle || "unknown"}
Title: ${title}
Body: ${bodyText.slice(0, 3000)}

Available categories:
${categoriesText}

Rules:
- Pick 1-3 category slugs from the available list only.
- Create 3-8 specific lowercase tags.
- Write a concise 1-2 sentence summary.
- Detect only actual AI image/video generation prompts, not general AI discussion or text/coding prompts.`,
    classificationSchema(categorySlugs)
  );

  return {
    ai_summary: typeof result.ai_summary === "string" ? result.ai_summary.slice(0, 500) : "",
    tags: Array.isArray(result.tags)
      ? result.tags
          .filter((tag): tag is string => typeof tag === "string" && tag.length >= 2)
          .map((tag) => tag.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
          .filter(Boolean)
      : [],
    category_slugs: Array.isArray(result.category_slugs)
      ? result.category_slugs.filter((slug) => categorySlugs.includes(slug))
      : [],
    has_prompt: result.has_prompt === true,
    prompt_text: result.has_prompt && typeof result.prompt_text === "string" ? result.prompt_text : null,
    prompt_type:
      result.has_prompt && (result.prompt_type === "image" || result.prompt_type === "video")
        ? result.prompt_type
        : null,
    confidence: typeof result.confidence === "number" ? result.confidence : 0.5,
  };
}

export async function translateToEnglish(
  title: string,
  bodyText: string
): Promise<TranslationResult> {
  const result = await runCodexJson<TranslationResult>(
    `Detect whether this FeedSilo item is primarily English. If not, translate it naturally to English.

Title:
${title.slice(0, 1000)}

Body:
${bodyText.slice(0, 12000)}

Preserve URLs, handles, hashtags, code, emoji, and paragraph breaks. Return JSON only.`,
    {
      type: "object",
      additionalProperties: false,
      properties: {
        language: { type: ["string", "null"] },
        translated_title: { type: ["string", "null"] },
        translated_body_text: { type: ["string", "null"] },
        translated: { type: "boolean" },
      },
      required: ["language", "translated_title", "translated_body_text", "translated"],
    }
  );

  return {
    language: result.language ? result.language.slice(0, 8) : null,
    translated: result.translated === true,
    translated_title: result.translated_title ? result.translated_title.slice(0, 2000) : null,
    translated_body_text: result.translated_body_text
      ? result.translated_body_text.slice(0, 60000)
      : null,
  };
}

export async function describeImage(imageUrl: string): Promise<ImageDescription> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "feedsilo-codex-image-"));
  const imagePath = path.join(tmpDir, "image");

  try {
    const response = await safeFetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    await fs.writeFile(imagePath, Buffer.from(await response.arrayBuffer()));

    return await runCodexJson<ImageDescription>(
      `Describe this image for FeedSilo. Return a short accessibility alt_text and a detailed 2-3 sentence ai_description as JSON only.`,
      {
        type: "object",
        additionalProperties: false,
        properties: {
          alt_text: { type: "string" },
          ai_description: { type: "string" },
        },
        required: ["alt_text", "ai_description"],
      },
      imagePath
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  void text;
  throw new Error("Codex OAuth provider does not support embeddings");
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  void texts;
  throw new Error("Codex OAuth provider does not support embeddings");
}
