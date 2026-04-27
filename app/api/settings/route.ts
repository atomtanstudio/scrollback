import { NextResponse } from "next/server";
import { getConfig, writeConfig, readConfig, invalidateConfigCache } from "@/lib/config";
import { getClient, disconnectClient } from "@/lib/db/client";
import { invalidateSearchProvider } from "@/lib/db/search-provider";
import { isR2Configured } from "@/lib/storage/r2";
import {
  getConfiguredLocalMediaPath,
  isLocalStorageConfigured,
} from "@/lib/storage/local-config";
import type { FeedsiloConfig } from "@/lib/config";
import { sanitizeErrorMessage } from "@/lib/security/redact";
import { requireAuth } from "@/lib/auth/session";
import { requireSetupUnlocked } from "@/lib/setup/guard";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "••••••••";
    }
    return parsed.toString();
  } catch {
    // SQLite file: URLs
    return url;
  }
}

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const role = session.user.role ?? "admin";
  const isAdmin = role === "admin";

  const config = getConfig();
  if (!config) {
    return NextResponse.json({ configured: false }, { headers: NO_STORE_HEADERS });
  }

  // R2 media counts
  let r2 = { configured: false, mediaWithStored: 0, mediaWithoutStored: 0 };
  const r2Configured = isR2Configured();
  if (r2Configured) {
    try {
      const prisma = await getClient();
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const [withStored, withoutStored] = await Promise.all([
        (prisma as any).media.count({ where: { stored_path: { not: null } } }),
        (prisma as any).media.count({ where: { stored_path: null } }),
      ]);
      /* eslint-enable @typescript-eslint/no-explicit-any */
      r2 = { configured: true, mediaWithStored: withStored, mediaWithoutStored: withoutStored };
    } catch {
      r2 = { configured: true, mediaWithStored: 0, mediaWithoutStored: 0 };
    }
  }

  const hasPairingToken = !!(process.env.CAPTURE_SECRET || config.extension?.pairingToken);

  // Fetch the current user's capture token
  let captureToken: string | null = null;
  if (session?.user?.id) {
    try {
      const prisma = await getClient();
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { capture_token: true },
      });
      captureToken = user?.capture_token ?? null;
    } catch {}
  }

  const embeddingsProvider = config.embeddings?.provider || "gemini";
  const hasAiKey = !!config.embeddings?.apiKey;

  return NextResponse.json({
    configured: true,
    database: {
      type: config.database.type,
      url: isAdmin ? maskUrl(config.database.url) : "Hidden in demo mode",
    },
    embeddings: {
      provider: embeddingsProvider,
      apiKey: config.embeddings?.apiKey ? "••••••••" : null,
      hasKey: hasAiKey,
    },
    extension: {
      hasPairingToken,
      managedByEnv: !!process.env.CAPTURE_SECRET,
      captureToken: isAdmin ? captureToken : null,
    },
    xapi: {
      hasBearerToken: !!config.xapi?.bearerToken,
    },
    search: {
      keywordWeight: config.search.keywordWeight,
      semanticWeight: config.search.semanticWeight,
    },
    r2,
    localMedia: {
      configured: isLocalStorageConfigured(),
      path: isAdmin
        ? (getConfiguredLocalMediaPath() ?? config.localMedia?.path ?? null)
        : "Hidden in demo mode",
    },
  }, { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  const session = await requireAuth();
  const isInitialSetupWrite = session instanceof NextResponse
    ? !(await requireSetupUnlocked())
    : false;

  if (session instanceof NextResponse && !isInitialSetupWrite) return session;
  if (!(session instanceof NextResponse) && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const current = readConfig() || getConfig();
    if (!current) {
      return NextResponse.json({ error: "Not configured" }, { status: 400 });
    }

    const updated: FeedsiloConfig = { ...current };

    if (body.database) {
      updated.database = { ...current.database, ...body.database };
    }
    if (body.embeddings) {
      updated.embeddings = { ...current.embeddings, ...body.embeddings };
    }
    if (body.extension) {
      updated.extension = { ...current.extension, ...body.extension };
    }
    if (body.xapi) {
      updated.xapi = { ...(current.xapi || {}), ...body.xapi };
    }
    if (body.search) {
      updated.search = { ...current.search, ...body.search };
    }
    if (body.localMedia !== undefined) {
      updated.localMedia = { ...(current.localMedia || {}), ...body.localMedia };
    }

    writeConfig(updated);
    invalidateConfigCache();

    // If database changed, disconnect old client
    if (body.database) {
      await disconnectClient();
      invalidateSearchProvider();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, "Update failed") },
      { status: 500 }
    );
  }
}
