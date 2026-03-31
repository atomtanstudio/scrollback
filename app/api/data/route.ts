import { NextResponse } from "next/server";
import { getClient, getDatabaseType } from "@/lib/db/client";
import { requireAuth } from "@/lib/auth/session";

export async function DELETE(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

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

    // Admin can target another user's items via userId param
    const targetUserId =
      body.userId && session.user.role === "admin" ? body.userId : session.user.id;

    // Delete content items (cascades to media, categories, tags relations)
    const result = await prisma.contentItem.deleteMany({
      where: { user_id: targetUserId },
    });

    // Clear FTS5 entries for the target user's items only
    if (dbType === "sqlite") {
      try {
        await prisma.$executeRawUnsafe(
          `DELETE FROM content_items_fts WHERE rowid NOT IN (SELECT rowid FROM content_items)`
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
