import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getClient } from "@/lib/db/client";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const key = process.env.XAPI_ENCRYPTION_KEY;
  if (!key) throw new Error("XAPI_ENCRYPTION_KEY not set");
  return Buffer.from(key, "hex"); // 32-byte hex string → 64 hex chars
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${encrypted}`;
}

export function decrypt(data: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, encrypted] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function storeTokens(data: {
  xUserId: string;
  xUsername: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string;
}): Promise<void> {
  const prisma = await getClient();
  await prisma.xApiConnection.upsert({
    where: { x_user_id: data.xUserId },
    create: {
      x_user_id: data.xUserId,
      x_username: data.xUsername,
      access_token_enc: encrypt(data.accessToken),
      refresh_token_enc: encrypt(data.refreshToken),
      token_expires_at: data.expiresAt,
      scopes: data.scopes,
    },
    update: {
      x_username: data.xUsername,
      access_token_enc: encrypt(data.accessToken),
      refresh_token_enc: encrypt(data.refreshToken),
      token_expires_at: data.expiresAt,
      scopes: data.scopes,
    },
  });
}

export async function loadTokens(): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  xUserId: string;
  xUsername: string;
} | null> {
  const prisma = await getClient();
  const conn = await prisma.xApiConnection.findFirst();
  if (!conn) return null;
  return {
    accessToken: decrypt(conn.access_token_enc),
    refreshToken: decrypt(conn.refresh_token_enc),
    expiresAt: conn.token_expires_at,
    xUserId: conn.x_user_id,
    xUsername: conn.x_username,
  };
}

export async function deleteTokens(): Promise<void> {
  const prisma = await getClient();
  await prisma.xApiConnection.deleteMany();
}
