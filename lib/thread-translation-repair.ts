import { getClient } from "@/lib/db/client";
import { getSearchProvider } from "@/lib/db/search-provider";
import { translateToEnglish, isAiConfigured } from "@/lib/embeddings";
import { needsRetranslation, originalLooksLikeForeignText } from "@/lib/translation-backfill";

type ThreadTranslationCandidate = {
  id: string;
  title: string | null;
  body_text: string;
  author_handle: string | null;
  author_display_name: string | null;
  language: string | null;
  translated_title: string | null;
  translated_body_text: string | null;
};

const pendingRepairs = new Set<string>();

export function scheduleThreadTranslationRepair(conversationId: string | null | undefined, userId: string) {
  if (!conversationId || !isAiConfigured()) return;

  const key = `${userId}:${conversationId}`;
  if (pendingRepairs.has(key)) return;
  pendingRepairs.add(key);

  setTimeout(() => {
    repairThreadTranslations(conversationId, userId)
      .catch((error) => console.warn(`Thread translation repair failed for ${conversationId}:`, error))
      .finally(() => pendingRepairs.delete(key));
  }, 15000);
}

async function repairThreadTranslations(conversationId: string, userId: string) {
  const prisma = await getClient();
  const provider = await getSearchProvider();

  const items: ThreadTranslationCandidate[] = await prisma.contentItem.findMany({
    where: {
      user_id: userId,
      source_type: "thread",
      conversation_id: conversationId,
    },
    select: {
      id: true,
      title: true,
      body_text: true,
      author_handle: true,
      author_display_name: true,
      language: true,
      translated_title: true,
      translated_body_text: true,
    },
    orderBy: [{ posted_at: "asc" }, { created_at: "asc" }],
    take: 100,
  });

  const queue = items.filter((item) =>
    (item.language?.toLowerCase() !== "en" || originalLooksLikeForeignText(item.title, item.body_text)) &&
    needsRetranslation(item)
  );

  for (const item of queue) {
    const translation = await translateToEnglish(item.title || "", item.body_text || "");
    if (!translation.translated) continue;

    const englishTitle = translation.translated_title || item.title || "";
    const englishBody = translation.translated_body_text || item.body_text || "";
    const authorParts = [item.author_handle, item.author_display_name].filter(Boolean).join(" ");

    await prisma.contentItem.update({
      where: { id: item.id },
      data: {
        language: translation.language,
        translated_title: translation.translated_title,
        translated_body_text: translation.translated_body_text,
      },
    });

    await provider.updateSearchVector(item.id, {
      title: englishTitle,
      body: englishBody,
      author: authorParts || undefined,
    });
  }
}
