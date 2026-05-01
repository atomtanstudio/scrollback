import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { getClient } from "@/lib/db/client";
import { downloadAndStoreMedia } from "@/lib/storage/download";
import { isLocalStorageConfigured } from "@/lib/storage/local";
import { isR2Configured } from "@/lib/storage/r2";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  if (!isR2Configured() && !isLocalStorageConfigured()) {
    return NextResponse.json(
      { error: "No media storage is configured." },
      { status: 400 }
    );
  }

  const { id } = await params;
  const db = await getClient();

  const targetUserId = request.nextUrl.searchParams.get("userId");
  const ownerFilter =
    session.user.role === "admin" && targetUserId ? targetUserId : session.user.id;

  const item = await db.contentItem.findFirst({
    where: { id, user_id: ownerFilter },
    select: {
      id: true,
      media_items: {
        select: {
          id: true,
          content_item_id: true,
          original_url: true,
          stored_path: true,
        },
        orderBy: { position_in_content: "asc" },
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (item.media_items.length === 0) {
    return NextResponse.json({
      success: true,
      stored: 0,
      failed: 0,
      skipped: 0,
      message: "This item has no media to backfill.",
    });
  }

  const pendingMedia = item.media_items.filter(
    (media: {
      id: string;
      content_item_id: string;
      original_url: string;
      stored_path: string | null;
    }) => !media.stored_path
  );

  if (pendingMedia.length === 0) {
    return NextResponse.json({
      success: true,
      stored: 0,
      failed: 0,
      skipped: item.media_items.length,
      message: "All media for this item is already stored.",
    });
  }

  let stored = 0;
  let failed = 0;

  for (const media of pendingMedia) {
    try {
      const storedPath = await downloadAndStoreMedia(
        media.id,
        media.content_item_id,
        media.original_url
      );

      if (storedPath) {
        await db.media.update({
          where: { id: media.id },
          data: { stored_path: storedPath },
        });
        stored++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    stored,
    failed,
    skipped: item.media_items.length - pendingMedia.length,
    message:
      failed > 0
        ? `Stored ${stored} media file${stored === 1 ? "" : "s"} with ${failed} failure${failed === 1 ? "" : "s"}.`
        : `Stored ${stored} media file${stored === 1 ? "" : "s"}.`,
  });
}
