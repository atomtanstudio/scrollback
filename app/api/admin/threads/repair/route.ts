import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getClient } from "@/lib/db/client";
import { getSearchProvider } from "@/lib/db/search-provider";
import { isAiConfigured, translateToEnglish } from "@/lib/embeddings";
import { needsRetranslation, originalLooksLikeForeignText } from "@/lib/translation-backfill";
import { sanitizeErrorMessage } from "@/lib/security/redact";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ThreadRepairCandidate = {
  id: string;
  external_id: string | null;
  created_at: Date;
  title: string | null;
  body_text: string;
  original_url: string | null;
  author_handle: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  language: string | null;
  translated_title: string | null;
  translated_body_text: string | null;
};

type XIdentity = {
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

function isMissingIdentity(item: ThreadRepairCandidate): boolean {
  return !item.author_handle?.trim() ||
    !item.author_display_name?.trim() ||
    !item.author_avatar_url?.trim();
}

function shouldRepairTranslation(item: ThreadRepairCandidate): boolean {
  return (item.language?.toLowerCase() !== "en" || originalLooksLikeForeignText(item.title, item.body_text)) &&
    needsRetranslation(item);
}

async function fetchXIdentity(tweetId: string): Promise<XIdentity | null> {
  const response = await fetch(
    `https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(tweetId)}&token=x`
  );
  if (!response.ok) return null;

  const data = await response.json();
  const user = data?.user || {};
  const handle = user.screen_name || user.username || data?.screen_name || data?.username || null;
  const displayName = user.name || data?.name || null;
  const avatarRaw = user.profile_image_url_https || user.profile_image_url || data?.profile_image_url_https || null;

  return {
    handle: handle ? String(handle).replace(/^@/, "") : null,
    displayName: displayName ? String(displayName) : null,
    avatarUrl: avatarRaw ? String(avatarRaw).replace("_normal.", "_400x400.") : null,
  };
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const db = await getClient();
  const provider = await getSearchProvider();
  const { searchParams } = request.nextUrl;
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "25", 10), 1), 100);
  const scan = Math.min(Math.max(parseInt(searchParams.get("scan") || "500", 10), limit), 2000);
  const cursor = searchParams.get("cursor");
  const cursorDate = cursor ? new Date(cursor) : null;
  const requestedUserId = searchParams.get("userId");
  const targetUserId = session.user.role === "admin" && requestedUserId
    ? requestedUserId
    : session.user.id;

  const baseWhere = {
    user_id: targetUserId,
    source_type: "thread" as const,
    ...(cursorDate && !Number.isNaN(cursorDate.getTime()) ? { created_at: { lt: cursorDate } } : {}),
  };

  const totalThreadRows = await db.contentItem.count({
    where: {
      user_id: targetUserId,
      source_type: "thread",
    },
  });

  const rows: ThreadRepairCandidate[] = await db.contentItem.findMany({
    where: baseWhere,
    select: {
      id: true,
      external_id: true,
      created_at: true,
      title: true,
      body_text: true,
      original_url: true,
      author_handle: true,
      author_display_name: true,
      author_avatar_url: true,
      language: true,
      translated_title: true,
      translated_body_text: true,
    },
    orderBy: [{ created_at: "desc" }],
    take: scan,
  });

  const candidateRows = rows.filter((item) => isMissingIdentity(item) || shouldRepairTranslation(item));
  const candidates = candidateRows.slice(0, limit);
  const nextCursor = rows.length > 0 ? rows[rows.length - 1].created_at.toISOString() : null;
  const hasMoreRows = rows.length === scan;

  let identityUpdated = 0;
  let translated = 0;
  let errors = 0;
  const repaired: Array<{ id: string; external_id: string | null; identity: boolean; translation: boolean }> = [];

  for (const item of candidates) {
    let repairedIdentity = false;
    let repairedTranslation = false;

    try {
      if (isMissingIdentity(item) && item.external_id) {
        const identity = await fetchXIdentity(item.external_id);
        if (identity) {
          const updateData: Record<string, string> = {};
          if (!item.author_handle?.trim() && identity.handle) updateData.author_handle = identity.handle;
          if (!item.author_display_name?.trim() && identity.displayName) updateData.author_display_name = identity.displayName;
          if (!item.author_avatar_url?.trim() && identity.avatarUrl) updateData.author_avatar_url = identity.avatarUrl;
          if (identity.handle && (!item.original_url || item.original_url.includes("/i/web/status/"))) {
            updateData.original_url = `https://x.com/${identity.handle}/status/${item.external_id}`;
          }

          if (Object.keys(updateData).length > 0) {
            await db.contentItem.update({ where: { id: item.id }, data: updateData });
            identityUpdated++;
            repairedIdentity = true;
            item.author_handle = updateData.author_handle || item.author_handle;
            item.author_display_name = updateData.author_display_name || item.author_display_name;
          }
        }
      }

      if (isAiConfigured() && shouldRepairTranslation(item)) {
        const translation = await translateToEnglish(item.title || "", item.body_text || "");
        if (translation.translated) {
          await db.contentItem.update({
            where: { id: item.id },
            data: {
              language: translation.language,
              translated_title: translation.translated_title,
              translated_body_text: translation.translated_body_text,
            },
          });

          const englishTitle = translation.translated_title || item.title || "";
          const englishBody = translation.translated_body_text || item.body_text || "";
          const authorParts = [item.author_handle, item.author_display_name].filter(Boolean).join(" ");
          await provider.updateSearchVector(item.id, {
            title: englishTitle,
            body: englishBody,
            author: authorParts || undefined,
          });

          translated++;
          repairedTranslation = true;
        }
      }

      repaired.push({
        id: item.id,
        external_id: item.external_id,
        identity: repairedIdentity,
        translation: repairedTranslation,
      });
    } catch (error) {
      errors++;
      repaired.push({
        id: item.id,
        external_id: item.external_id,
        identity: repairedIdentity,
        translation: repairedTranslation,
      });
      console.warn(`Thread repair failed for ${item.id}:`, sanitizeErrorMessage(error, "Unknown error"));
    }
  }

  return NextResponse.json({
    success: true,
    totalThreadRows,
    scanned: rows.length,
    candidateRows: candidateRows.length,
    selected: candidates.length,
    processed: repaired.length,
    identityUpdated,
    translated,
    errors,
    nextCursor,
    hasMoreRows,
    hasMore: hasMoreRows,
    repaired,
  });
}
