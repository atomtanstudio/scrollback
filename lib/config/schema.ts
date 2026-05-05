import { z } from "zod";

export const databaseConfigSchema = z.object({
  type: z.enum(["postgresql", "supabase", "sqlite"]),
  url: z.string().min(1),
});

export const embeddingsConfigSchema = z.object({
  provider: z.enum(["gemini", "openai"]).default("gemini"),
  apiKey: z.string().optional(),
});

export const extensionConfigSchema = z.object({
  pairingToken: z.string().optional(),
});

export const xapiConfigSchema = z.object({
  bearerToken: z.string().optional(),
});

export const searchConfigSchema = z.object({
  keywordWeight: z.number().min(0).max(1).default(0.4),
  semanticWeight: z.number().min(0).max(1).default(0.6),
});

export const localMediaConfigSchema = z.object({
  path: z.string().optional(),
});

export const configSchema = z.object({
  database: databaseConfigSchema,
  embeddings: embeddingsConfigSchema.default({ provider: "gemini" }),
  extension: extensionConfigSchema.default({}),
  xapi: xapiConfigSchema.default({}),
  search: searchConfigSchema.default({ keywordWeight: 0.4, semanticWeight: 0.6 }),
  localMedia: localMediaConfigSchema.default({}),
});

export type ScrollbackConfig = z.infer<typeof configSchema>;
export type DatabaseType = ScrollbackConfig["database"]["type"];
export type AiProvider = ScrollbackConfig["embeddings"]["provider"];
