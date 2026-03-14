import { NextResponse } from "next/server";
import { getConfig, readConfig } from "@/lib/config";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function POST() {
  if (process.env.CAPTURE_SECRET) {
    return NextResponse.json(
      { error: "Capture token is managed by CAPTURE_SECRET and cannot be revealed here." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const current = readConfig() || getConfig();
  const token = current?.extension?.pairingToken;

  if (!token) {
    return NextResponse.json(
      { error: "No pairing token configured" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json({ token }, { headers: NO_STORE_HEADERS });
}
