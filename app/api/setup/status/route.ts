import { NextResponse } from "next/server";
import { getConfig, isConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getConfig();
  return NextResponse.json({
    configured: isConfigured(config),
    databaseType: config?.database.type ?? null,
  });
}
