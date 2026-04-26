import { getConfig } from "@/lib/config";

export function getConfiguredLocalMediaPath(): string | null {
  return process.env.LOCAL_MEDIA_PATH || getConfig()?.localMedia?.path || null;
}

export function isLocalStorageConfigured(): boolean {
  return !!getConfiguredLocalMediaPath();
}
