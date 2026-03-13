import { NextResponse } from "next/server";
import { getConfig, writeConfig, readConfig, invalidateConfigCache } from "@/lib/config";
import { disconnectClient } from "@/lib/db/client";
import { invalidateSearchProvider } from "@/lib/db/search-provider";
import type { FeedsiloConfig } from "@/lib/config";

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
  const config = getConfig();
  if (!config) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    database: {
      type: config.database.type,
      url: maskUrl(config.database.url),
    },
    embeddings: {
      provider: config.embeddings?.provider || "gemini",
      apiKey: config.embeddings?.apiKey ? "••••••••" : null,
      hasKey: !!config.embeddings?.apiKey,
    },
    extension: {
      pairingToken: config.extension?.pairingToken || null,
    },
    search: {
      keywordWeight: config.search.keywordWeight,
      semanticWeight: config.search.semanticWeight,
    },
  });
}

export async function POST(request: Request) {
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
    if (body.search) {
      updated.search = { ...current.search, ...body.search };
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
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}
