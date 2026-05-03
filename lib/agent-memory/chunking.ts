export const DEFAULT_CHUNK_MAX_CHARS = 2200;
export const DEFAULT_CHUNK_OVERLAP_CHARS = 280;

export type AgentMemorySourceItem = {
  id: string;
  user_id: string;
  source_type: string;
  source_platform: string;
  title: string;
  body_text: string;
  translated_title?: string | null;
  translated_body_text?: string | null;
  ai_summary?: string | null;
  prompt_text?: string | null;
  author_handle?: string | null;
  author_display_name?: string | null;
  original_url?: string | null;
  posted_at?: string | Date | null;
  created_at: string | Date;
  content_hash: string;
  tags?: string[] | null;
  categories?: string[] | null;
  media_descriptions?: string[] | null;
};

export type AgentMemoryChunkInput = {
  content_item_id: string;
  user_id: string;
  chunk_index: number;
  chunk_kind: "body" | "prompt" | "media";
  chunk_text: string;
  title: string;
  source_url: string | null;
  source_platform: string;
  source_type: string;
  author_handle: string | null;
  author_display_name: string | null;
  posted_at: string | Date | null;
  item_created_at: string | Date;
  content_hash: string;
  metadata: Record<string, unknown>;
};

function compactWhitespace(value: string): string {
  return value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function joinLabeledSections(sections: Array<[string, string | null | undefined]>): string {
  return compactWhitespace(
    sections
      .filter(([, value]) => value && value.trim().length > 0)
      .map(([label, value]) => `${label}:\n${value?.trim()}`)
      .join("\n\n")
  );
}

function splitAtNaturalBoundary(text: string, targetEnd: number): number {
  const minEnd = Math.max(0, targetEnd - 500);
  const boundaryPatterns = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", "];

  for (const pattern of boundaryPatterns) {
    const idx = text.lastIndexOf(pattern, targetEnd);
    if (idx >= minEnd) return idx + pattern.length;
  }

  return targetEnd;
}

export function chunkText(
  text: string,
  maxChars = DEFAULT_CHUNK_MAX_CHARS,
  overlapChars = DEFAULT_CHUNK_OVERLAP_CHARS
): string[] {
  const normalized = compactWhitespace(text);
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const rawEnd = Math.min(normalized.length, start + maxChars);
    const end = rawEnd === normalized.length ? rawEnd : splitAtNaturalBoundary(normalized, rawEnd);
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= normalized.length) break;
    start = Math.max(0, end - overlapChars);
    while (start > 0 && start < normalized.length && /\S/.test(normalized[start - 1])) {
      start += 1;
      if (start >= end) break;
    }
  }

  return chunks;
}

function itemBodyText(item: AgentMemorySourceItem): string {
  return joinLabeledSections([
    ["Title", item.translated_title || item.title],
    ["Original title", item.translated_title ? item.title : null],
    ["Summary", item.ai_summary],
    ["Body", item.translated_body_text || item.body_text],
    ["Original body", item.translated_body_text ? item.body_text : null],
  ]);
}

export function buildAgentMemoryChunks(item: AgentMemorySourceItem): AgentMemoryChunkInput[] {
  const base = {
    content_item_id: item.id,
    user_id: item.user_id,
    title: item.translated_title || item.title,
    source_url: item.original_url || null,
    source_platform: item.source_platform,
    source_type: item.source_type,
    author_handle: item.author_handle || null,
    author_display_name: item.author_display_name || null,
    posted_at: item.posted_at || null,
    item_created_at: item.created_at,
    content_hash: item.content_hash,
  };
  const metadata = {
    tags: item.tags || [],
    categories: item.categories || [],
  };

  const chunks: AgentMemoryChunkInput[] = [];
  const bodyChunks = chunkText(itemBodyText(item));
  for (const [index, chunk] of bodyChunks.entries()) {
    chunks.push({
      ...base,
      chunk_index: index,
      chunk_kind: "body",
      chunk_text: chunk,
      metadata,
    });
  }

  if (item.prompt_text?.trim()) {
    chunks.push({
      ...base,
      chunk_index: chunks.length,
      chunk_kind: "prompt",
      chunk_text: joinLabeledSections([
        ["Title", item.translated_title || item.title],
        ["Prompt", item.prompt_text],
      ]),
      metadata: { ...metadata, prompt: true },
    });
  }

  for (const description of item.media_descriptions || []) {
    if (!description.trim()) continue;
    chunks.push({
      ...base,
      chunk_index: chunks.length,
      chunk_kind: "media",
      chunk_text: joinLabeledSections([
        ["Title", item.translated_title || item.title],
        ["Media description", description],
      ]),
      metadata: { ...metadata, media: true },
    });
  }

  return chunks;
}
