import { normalizeCapturedText } from "@/lib/text-cleanup";

export interface ParsedContent {
  segments: ContentSegment[];
}

export type ContentSegment =
  | { type: 'text'; content: string }
  | { type: 'json'; content: string; parsed: unknown }
  | { type: 'code'; content: string; language?: string };

/**
 * Find the end index of a balanced brace/bracket block starting at `start`.
 * Returns -1 if the block is not balanced before the end of the string.
 */
function findBalancedEnd(text: string, start: number): number {
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

/**
 * Try to parse a substring as JSON with enough substance to be worth
 * displaying as a code block. Requires at least 2 keys (objects) or
 * 2 elements (arrays), and a minimum length of 20 chars to avoid
 * extracting tiny snippets like [0.9] or {"x":1} as code blocks.
 */
function tryParseJson(text: string): unknown | null {
  if (text.length < 20) return null;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null) {
      if (Array.isArray(parsed)) {
        return parsed.length >= 2 ? parsed : null;
      }
      return Object.keys(parsed).length >= 2 ? parsed : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse body text to find JSON blocks and markdown code fences embedded in the text.
 * Returns an array of segments: text, json, or code.
 *
 * Strategy:
 * 1. Detect markdown code fences (```language\n...\n```)
 * 2. Scan remaining text for balanced { } or [ ] blocks that are valid JSON with ≥1 key/element
 * 3. Everything else is plain text
 */
export function parseBodyContent(bodyText: string): ParsedContent {
  const normalizedBodyText = normalizeCapturedText(bodyText);

  if (!normalizedBodyText || normalizedBodyText.trim() === '') {
    return { segments: [] };
  }

  const segments: ContentSegment[] = [];

  // Regex for markdown code fences: ```optional-language\ncontent\n```
  const codeFenceRegex = /```(\w*)\n([\s\S]*?)```/g;

  // We'll collect all "protected" ranges (code fences and JSON blocks) to avoid double-parsing
  interface Range {
    start: number;
    end: number; // inclusive
    segment: ContentSegment;
  }

  const ranges: Range[] = [];

  // Pass 1: Find all markdown code fences
  let match: RegExpExecArray | null;
  codeFenceRegex.lastIndex = 0;
  while ((match = codeFenceRegex.exec(normalizedBodyText)) !== null) {
    const language = match[1] || undefined;
    const codeContent = match[2];

    if (language === 'json') {
      const parsed = tryParseJson(codeContent.trim());
      if (parsed !== null) {
        ranges.push({
          start: match.index,
          end: match.index + match[0].length - 1,
          segment: {
            type: 'json',
            content: JSON.stringify(parsed, null, 2),
            parsed,
          },
        });
        continue;
      }
    }

    ranges.push({
      start: match.index,
      end: match.index + match[0].length - 1,
      segment: {
        type: 'code',
        content: codeContent,
        language: language || undefined,
      },
    });
  }

  // Pass 2: Scan text for balanced { } and [ ] blocks not already covered by a code fence range
  const isInProtectedRange = (idx: number): boolean =>
    ranges.some((r) => idx >= r.start && idx <= r.end);

  for (let i = 0; i < normalizedBodyText.length; i++) {
    const ch = normalizedBodyText[i];

    if (ch !== '{' && ch !== '[') continue;
    if (isInProtectedRange(i)) continue;

    const end = findBalancedEnd(normalizedBodyText, i);
    if (end === -1) continue;

    // Make sure the entire candidate block is not inside a protected range
    if (isInProtectedRange(end)) continue;

    const candidate = normalizedBodyText.slice(i, end + 1);
    const parsed = tryParseJson(candidate);
    if (parsed === null) continue;

    ranges.push({
      start: i,
      end,
      segment: {
        type: 'json',
        content: JSON.stringify(parsed, null, 2),
        parsed,
      },
    });

    // Skip past this block
    i = end;
  }

  // Sort ranges by start position
  ranges.sort((a, b) => a.start - b.start);

  // Build segments by filling text between ranges
  let cursor = 0;
  for (const range of ranges) {
    if (cursor < range.start) {
      const textContent = normalizedBodyText.slice(cursor, range.start);
      if (textContent) {
        segments.push({ type: 'text', content: textContent });
      }
    }
    segments.push(range.segment);
    cursor = range.end + 1;
  }

  // Remaining text after the last range
  if (cursor < normalizedBodyText.length) {
    const textContent = normalizedBodyText.slice(cursor);
    if (textContent) {
      segments.push({ type: 'text', content: textContent });
    }
  }

  // If no segments were produced, return the whole thing as text
  if (segments.length === 0) {
    return { segments: [{ type: 'text', content: normalizedBodyText }] };
  }

  return { segments };
}
