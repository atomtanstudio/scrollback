const STRONG_PROMPT_CUES = [
  /--ar\s+\d+:\d+/i,
  /--v\s+[\d.]+/i,
  /--style\s+\w+/i,
  /--q\s+[\d.]+/i,
  /--s\s+\d+/i,
  /\/imagine\b/i,
  /\bcfg[\s_]?scale\b/i,
  /\bnegative[\s_]?prompt\b/i,
  /\bsampler\b/i,
  /\bseed\b/i,
  /\btxt2img\b/i,
  /\bimg2img\b/i,
  /\btxt2vid\b/i,
  /\bimg2vid\b/i,
];

const PROMPT_STYLE_CUES = [
  /\b(?:cinematic|photorealistic|hyperrealistic|volumetric|dramatic lighting|soft lighting)\b/i,
  /\b(?:35mm|50mm|85mm|anamorphic|macro shot|close-up|wide shot|isometric)\b/i,
  /\b(?:octane render|unreal engine|depth of field|bokeh|color grading)\b/i,
  /\b(?:low poly|watercolor|oil painting|concept art|character design)\b/i,
];

const DISCUSSION_CUES = [
  /\b(?:review|tutorial|guide|comparison|benchmark|workflow|news|thread)\b/i,
  /\b(?:github|repository|repo|open-source|best practice|fastest-growing)\b/i,
  /\b(?:tool|model|framework|agent|agents|assistant)\b/i,
];

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function hasExplicitPromptSnippet(text: string): boolean {
  const normalized = normalize(text);

  const directPatterns = [
    /(?:^|\b)(?:image|video)?\s*prompt\s*:\s*(.{20,400})/i,
    /\bhere(?:'s| is) (?:the|my) prompt\b[:\s-]*(.{20,400})/i,
    /\bprompt (?:i|I) used\b[:\s-]*(.{20,400})/i,
    /\bsharing (?:the|my) prompt\b[:\s-]*(.{20,400})/i,
  ];

  for (const pattern of directPatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const candidate = normalize(match[1] || "");
    if (candidate.split(" ").filter(Boolean).length >= 5) return true;
  }

  return false;
}

export function isLikelyVisualPromptText(text: string | null | undefined): boolean {
  if (!text) return false;

  const normalized = normalize(text);
  const words = normalized.split(" ").filter(Boolean);
  if (words.length < 5 || normalized.length < 24) return false;

  if (STRONG_PROMPT_CUES.some((pattern) => pattern.test(normalized))) return true;
  if (PROMPT_STYLE_CUES.some((pattern) => pattern.test(normalized))) return true;

  const commaCount = (normalized.match(/,/g) || []).length;
  if (commaCount >= 2 && !DISCUSSION_CUES.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  return false;
}
