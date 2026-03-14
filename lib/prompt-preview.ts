const STRONG_PROMPT_HINTS = [
  /--ar\s+\d+:\d+/i,
  /--v\s+[\d.]+/i,
  /\/imagine\b/i,
  /\bcfg[\s_]?scale\b/i,
  /\bnegative[\s_]?prompt\b/i,
  /\bsampler\b/i,
  /\bseed\b/i,
  /\bcontrolnet\b/i,
  /\b(?:image|video)\s+prompt\b/i,
  /\bprompt\s*:/i,
  /\bjson\b.*\bprompt\b/i,
  /\b(?:steps?|stylize|chaos|aspect ratio|camera angle)\b/i,
];

const TOOL_HINTS = [
  /\bmidjourney\b/i,
  /\bflux\b/i,
  /\bsd(?:xl|3)?\b/i,
  /\bideogram\b/i,
  /\bfirefly\b/i,
  /\bsora\b/i,
  /\bveo(?:\s*[23])?\b/i,
  /\brunway\b/i,
  /\bkling\b/i,
  /\bpika\b/i,
  /\bluma\b/i,
  /\bseedance\b/i,
];

export interface PromptPreview {
  label: "Image Prompt" | "Video Prompt" | "Prompt";
  preview: string;
  fullText: string;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function inferPromptLabel(text: string, mediaType: string): PromptPreview["label"] {
  if (/\b(video|cinematic motion|camera move|fps|animate)\b/i.test(text)) {
    return "Video Prompt";
  }
  if (mediaType === "video" || mediaType === "gif") {
    return "Video Prompt";
  }
  if (/\b(image|photo|illustration|render|portrait)\b/i.test(text)) {
    return "Image Prompt";
  }
  return "Prompt";
}

function looksLikePrompt(text: string): boolean {
  if (text.length < 48) return false;
  if (STRONG_PROMPT_HINTS.some((pattern) => pattern.test(text))) return true;

  const mentionsTool = TOOL_HINTS.some((pattern) => pattern.test(text));
  const mentionsPrompt = /\bprompt\b/i.test(text);
  if (mentionsTool && mentionsPrompt) return true;

  const colonSections = text.split(":").length - 1;
  const commaSections = text.split(",").length - 1;
  if (mentionsPrompt && (colonSections >= 1 || commaSections >= 4)) return true;

  return false;
}

export function getPromptPreview(
  text: string | null | undefined,
  mediaType: string
): PromptPreview | null {
  if (!text) return null;
  const normalized = normalizeText(text);
  if (!looksLikePrompt(normalized)) return null;

  const preview =
    normalized.length > 220 ? `${normalized.slice(0, 217).trimEnd()}...` : normalized;

  return {
    label: inferPromptLabel(normalized, mediaType),
    preview,
    fullText: normalized,
  };
}
