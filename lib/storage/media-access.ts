import { getClient } from "@/lib/db/client";

const MEDIA_KEY_RE = /^media\/([^/]+)\/([^/.]+)\.[A-Za-z0-9]{1,10}$/;

export function parseMediaStorageKey(key: string): { contentItemId: string; mediaId: string } | null {
  const match = key.match(MEDIA_KEY_RE);
  if (!match) return null;
  return { contentItemId: match[1], mediaId: match[2] };
}

export async function canAccessMediaStorageKey(
  key: string,
  userId: string,
  role?: string | null
): Promise<boolean> {
  const parsed = parseMediaStorageKey(key);
  if (!parsed) return false;

  const prisma = await getClient();
  const media = await prisma.media.findFirst({
    where: {
      id: parsed.mediaId,
      content_item_id: parsed.contentItemId,
      ...(role === "admin" ? {} : { content_item: { user_id: userId } }),
    },
    select: { id: true },
  });

  return !!media;
}
