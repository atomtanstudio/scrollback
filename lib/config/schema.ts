import { z } from "zod";

export const databaseConfigSchema = z.object({
  type: z.enum(["postgresql", "supabase", "sqlite"]),
  url: z.string().min(1),
});

export const embeddingsConfigSchema = z.object({
  provider: z.enum(["gemini"]).default("gemini"),
  apiKey: z.string().optional(),
});

export const extensionConfigSchema = z.object({
  pairingToken: z.string().optional(),
});

export const searchConfigSchema = z.object({
  keywordWeight: z.number().min(0).max(1).default(0.4),
  semanticWeight: z.number().min(0).max(1).default(0.6),
});

export const configSchema = z.object({
  database: databaseConfigSchema,
  embeddings: embeddingsConfigSchema.default({ provider: "gemini" }),
  extension: extensionConfigSchema.default({}),
  search: searchConfigSchema.default({ keywordWeight: 0.4, semanticWeight: 0.6 }),
});

export type FeedsiloConfig = z.infer<typeof configSchema>;
export type DatabaseType = FeedsiloConfig["database"]["type"];
