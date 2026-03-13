import { getClient } from "@/lib/db/client";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") || "json";
  const prisma = await getClient();

  const items = await prisma.contentItem.findMany({
    orderBy: { created_at: "desc" },
    select: {
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
    },
  });

  if (format === "csv") {
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

  // JSON (NDJSON)
  const ndjson = items.map((item) => JSON.stringify(item)).join("\n");

  return new Response(ndjson, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": 'attachment; filename="feedsilo-export.json"',
    },
  });
}
