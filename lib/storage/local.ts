import { createWriteStream, promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import {
  getConfiguredLocalMediaPath,
  isLocalStorageConfigured,
} from "@/lib/storage/local-config";

export { isLocalStorageConfigured };

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

function resolveConfiguredPath(configuredPath: string): string {
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), configuredPath);
}

export function getLocalMediaDir(): string | null {
  const configuredPath = getConfiguredLocalMediaPath();
  return configuredPath ? resolveConfiguredPath(configuredPath) : null;
}

export async function saveMediaLocally(key: string, body: Buffer): Promise<string> {
  const baseDir = getLocalMediaDir()!;
  const resolvedBaseDir = path.resolve(/* turbopackIgnore: true */ baseDir);
  const fullPath = path.resolve(/* turbopackIgnore: true */ resolvedBaseDir, key);
  if (!fullPath.startsWith(resolvedBaseDir + path.sep) && fullPath !== resolvedBaseDir) {
    throw new Error("Path traversal detected");
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, body);
  return `local/${key}`;
}

export async function saveMediaLocallyStream(key: string, body: ReadableStream): Promise<string> {
  const baseDir = getLocalMediaDir()!;
  const resolvedBaseDir = path.resolve(/* turbopackIgnore: true */ baseDir);
  const fullPath = path.resolve(/* turbopackIgnore: true */ resolvedBaseDir, key);
  if (!fullPath.startsWith(resolvedBaseDir + path.sep) && fullPath !== resolvedBaseDir) {
    throw new Error("Path traversal detected");
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  try {
    await pipeline(
      Readable.fromWeb(body as import("stream/web").ReadableStream),
      createWriteStream(fullPath)
    );
  } catch (error) {
    await fs.rm(fullPath, { force: true }).catch(() => undefined);
    throw error;
  }
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
  const resolvedBaseDir = path.resolve(/* turbopackIgnore: true */ baseDir);
  const fullPath = path.resolve(/* turbopackIgnore: true */ resolvedBaseDir, key);
  if (!fullPath.startsWith(resolvedBaseDir + path.sep)) return null;
  try {
    const buffer = await fs.readFile(fullPath);
    return { buffer, contentType: contentTypeForPath(fullPath) };
  } catch {
    return null;
  }
}
