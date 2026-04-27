import { getConfig } from "@/lib/config";
import type {
  ClassificationResult,
  ImageDescription,
  TranslationResult,
} from "./gemini";
import type { CategoryOption } from "@/lib/default-categories";

function getProvider() {
  return getConfig()?.embeddings?.provider || "gemini";
}

export function isAiConfigured(): boolean {
  const config = getConfig();
  return !!config?.embeddings?.apiKey;
}

export function getAiProviderLabel(): string {
  return getProvider() === "openai" ? "OpenAI" : "Gemini";
}

export function supportsEmbeddings(): boolean {
  return true;
}

async function loadProvider() {
  const provider = getProvider();
  if (provider === "openai") return import("./openai");
  return import("./gemini");
}

export type { ClassificationResult, ImageDescription, TranslationResult };

export async function classifyContent(
  title: string,
  bodyText: string,
  sourceType: string,
  categoryOptions: CategoryOption[],
  authorHandle?: string | null
): Promise<ClassificationResult> {
  const provider = await loadProvider();
  return provider.classifyContent(title, bodyText, sourceType, categoryOptions, authorHandle);
}

export async function translateToEnglish(
  title: string,
  bodyText: string
): Promise<TranslationResult> {
  const provider = await loadProvider();
  return provider.translateToEnglish(title, bodyText);
}

export async function describeImage(imageUrl: string): Promise<ImageDescription> {
  const provider = await loadProvider();
  return provider.describeImage(imageUrl);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = await loadProvider();
  return provider.generateEmbedding(text);
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const provider = await loadProvider();
  return provider.generateEmbeddings(texts);
}
