import { promises as fs } from "fs";
import path from "path";
import { getConfig } from "@/lib/config";

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  bin: "application/octet-stream",
};

export function getLocalMediaDir(): string | null {
  const fromEnv = process.env.LOCAL_MEDIA_PATH;
  if (fromEnv) return path.resolve(fromEnv);
  const fromConfig = getConfig()?.localMedia?.path;
  if (fromConfig) return path.resolve(fromConfig);
  return null;
}

export function isLocalStorageConfigured(): boolean {
  return !!getLocalMediaDir();
}

export async function saveMediaLocally(key: string, body: Buffer): Promise<string> {
  const baseDir = getLocalMediaDir()!;
  const fullPath = path.resolve(baseDir, key);
  if (!fullPath.startsWith(path.resolve(baseDir) + path.sep) && fullPath !== path.resolve(baseDir)) {
    throw new Error("Path traversal detected");
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, body);
  return `local/${key}`;
}

export async function saveMediaLocallyStream(key: string, body: ReadableStream): Promise<string> {
  const baseDir = getLocalMediaDir()!;
  const fullPath = path.resolve(baseDir, key);
  if (!fullPath.startsWith(path.resolve(baseDir) + path.sep) && fullPath !== path.resolve(baseDir)) {
    throw new Error("Path traversal detected");
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  const chunks: Uint8Array[] = [];
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  await fs.writeFile(fullPath, Buffer.concat(chunks));
  return `local/${key}`;
}

export function contentTypeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  return EXT_TO_CONTENT_TYPE[ext] ?? "application/octet-stream";
}

export async function readLocalMedia(
  key: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const baseDir = getLocalMediaDir();
  if (!baseDir) return null;
  const fullPath = path.resolve(baseDir, key);
  if (!fullPath.startsWith(path.resolve(baseDir) + path.sep)) return null;
  try {
    const buffer = await fs.readFile(fullPath);
    return { buffer, contentType: contentTypeForPath(fullPath) };
  } catch {
    return null;
  }
}
