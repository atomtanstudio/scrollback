import { NextResponse } from "next/server";
import { getClient, getDatabaseType } from "@/lib/db/client";

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    if (body.confirmation !== "DELETE") {
      return NextResponse.json(
        { error: "Type DELETE to confirm" },
        { status: 400 }
      );
    }

    const prisma = await getClient();
    const dbType = getDatabaseType();

    // Delete all content items (cascades to media, categories, tags relations)
    const result = await prisma.contentItem.deleteMany({});

    // Clear FTS5 table for SQLite
    if (dbType === "sqlite") {
      try {
        await prisma.$executeRawUnsafe(
          `DELETE FROM content_items_fts`
        );
      } catch {
        // FTS table might not exist yet
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
