import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readConfig, getConfig, writeConfig, invalidateConfigCache } from "@/lib/config";

export async function POST() {
  try {
    const current = readConfig() || getConfig();
    if (!current) {
      return NextResponse.json({ error: "Not configured" }, { status: 400 });
    }

    const newToken = uuidv4();
    const updated = {
      ...current,
      extension: { ...current.extension, pairingToken: newToken },
    };

    writeConfig(updated);
    invalidateConfigCache();

    return NextResponse.json({ token: newToken });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to regenerate token" },
      { status: 500 }
    );
  }
}
