import { getClient } from "@/lib/db/client";
import { NextRequest } from "next/server";

const MAX_EXPORT = 5000;

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") || "json";
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") || String(MAX_EXPORT), 10),
    MAX_EXPORT
  );
  const prisma = await getClient();

  const selectFields = {
    id: true,
    source_type: true,
    title: true,
    body_text: true,
    author_handle: true,
    author_display_name: true,
    original_url: true,
    posted_at: true,
    created_at: true,
    likes: true,
    retweets: true,
    replies: true,
    views: true,
  };

  if (format === "csv") {
    const items = await prisma.contentItem.findMany({
      orderBy: { created_at: "desc" },
      select: selectFields,
      take: limit,
    });

    const headers = [
      "id", "source_type", "title", "body_text", "author_handle",
      "author_display_name", "original_url", "posted_at", "created_at",
      "likes", "retweets", "replies", "views",
    ];

    const escapeCsv = (val: unknown) => {
      const s = String(val ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [headers.join(",")];
    for (const item of items) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = headers.map((h) => escapeCsv((item as any)[h]));
      lines.push(row.join(","));
    }

    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="feedsilo-export.csv"',
      },
    });
  }

  // JSON (NDJSON) — stream to avoid buffering everything
  const items = await prisma.contentItem.findMany({
    orderBy: { created_at: "desc" },
    select: selectFields,
    take: limit,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ndjson = items.map((item: any) => JSON.stringify(item)).join("\n");

  return new Response(ndjson, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": 'attachment; filename="feedsilo-export.json"',
    },
  });
}
