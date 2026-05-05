import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";

const PROJECT_ROOT = /* turbopackIgnore: true */ process.cwd();
const SETUP_TOKEN_PATH = path.join(PROJECT_ROOT, ".scrollback-setup-token");

function normalizeToken(value: string | undefined | null): string | null {
  const token = value?.trim();
  return token && token.length >= 16 ? token : null;
}

function timingSafeEqualText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function readFileToken(): string | null {
  try {
    return normalizeToken(fs.readFileSync(SETUP_TOKEN_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function createFileToken(): string {
  const token = crypto.randomBytes(24).toString("base64url");
  fs.writeFileSync(SETUP_TOKEN_PATH, `${token}\n`, { mode: 0o600 });
  return token;
}

export function getSetupToken(): string {
  return (
    normalizeToken(process.env.SCROLLBACK_SETUP_TOKEN) ||
    normalizeToken(process.env.SETUP_TOKEN) ||
    readFileToken() ||
    createFileToken()
  );
}

export function getProvidedSetupToken(request?: Request | NextRequest | null): string | null {
  const headerToken =
    request?.headers.get("x-scrollback-setup-token") ||
    request?.headers.get("x-setup-token");
  if (headerToken) return normalizeToken(headerToken);

  const authorization = request?.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return normalizeToken(authorization.slice("bearer ".length));
  }

  return null;
}

export function isValidSetupToken(value: string | undefined | null): boolean {
  const expected = getSetupToken();
  const provided = normalizeToken(value);
  return !!provided && timingSafeEqualText(provided, expected);
}

export function getSetupTokenHint(): string {
  if (normalizeToken(process.env.SCROLLBACK_SETUP_TOKEN) || normalizeToken(process.env.SETUP_TOKEN)) {
    return "Use the setup token from SCROLLBACK_SETUP_TOKEN.";
  }
  getSetupToken();
  return "Use the setup token stored in .scrollback-setup-token on the server.";
}
