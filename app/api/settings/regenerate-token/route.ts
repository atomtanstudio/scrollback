import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readConfig, getConfig, writeConfig, invalidateConfigCache } from "@/lib/config";
import { sanitizeErrorMessage } from "@/lib/security/redact";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function POST() {
  try {
    if (process.env.CAPTURE_SECRET) {
      return NextResponse.json(
        { error: "Capture token is managed by CAPTURE_SECRET and cannot be rotated here." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const current = readConfig() || getConfig();
    if (!current) {
      return NextResponse.json({ error: "Not configured" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const newToken = uuidv4();
    const updated = {
      ...current,
      extension: { ...current.extension, pairingToken: newToken },
    };

    writeConfig(updated);
    invalidateConfigCache();

    return NextResponse.json({ token: newToken }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, "Failed to regenerate token") },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
