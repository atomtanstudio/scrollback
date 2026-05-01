import { execFileSync } from "child_process";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function gitValue(args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json({
    commit:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GIT_COMMIT ||
      gitValue(["rev-parse", "HEAD"]),
    branch:
      process.env.VERCEL_GIT_COMMIT_REF ||
      process.env.GIT_BRANCH ||
      gitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
  });
}
