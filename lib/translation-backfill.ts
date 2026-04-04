const CJK_CHAR_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const HANGUL_CHAR_REGEX = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g;
const LATIN_CHAR_REGEX = /[A-Za-z]/g;

function countMatches(value: string, regex: RegExp): number {
  return value.match(regex)?.length || 0;
}

function countSourceScriptChars(value: string): number {
  return countMatches(value, CJK_CHAR_REGEX) + countMatches(value, HANGUL_CHAR_REGEX);
}

function looksMostlyEnglish(text: string): boolean {
  const latinCount = countMatches(text, LATIN_CHAR_REGEX);
  const sourceScriptCount = countSourceScriptChars(text);

  if (latinCount === 0) return false;
  if (sourceScriptCount === 0) return true;
  return latinCount >= sourceScriptCount * 2;
}

export function originalLooksLikeForeignText(title: string | null | undefined, bodyText: string | null | undefined): boolean {
  const sample = `${title || ""}\n${bodyText || ""}`.trim();
  return countSourceScriptChars(sample) >= 4;
}

export function needsRetranslation(item: {
  title?: string | null;
  body_text: string;
  language?: string | null;
  translated_title?: string | null;
  translated_body_text?: string | null;
}): boolean {
  const originalBody = item.body_text || "";
  const translatedBody = item.translated_body_text || "";
  const translatedTitle = item.translated_title || "";
  const normalizedLanguage = (item.language || "").toLowerCase();
  const originalLooksForeign = originalLooksLikeForeignText(item.title, originalBody);
  const translatedSourceChars = countSourceScriptChars(translatedBody);
  const originalSourceChars = countSourceScriptChars(originalBody);

  if (!translatedBody) return normalizedLanguage !== "en" || originalLooksForeign;

  if (originalBody.length > 4000 && translatedBody.length < originalBody.length * 0.5) {
    return true;
  }

  if (translatedBody.trim() === originalBody.trim()) {
    return true;
  }

  if (originalLooksForeign && !looksMostlyEnglish(translatedBody)) {
    return true;
  }

  if (originalSourceChars >= 6 && translatedSourceChars >= Math.max(4, Math.floor(originalSourceChars * 0.35))) {
    return true;
  }

  if (!translatedTitle && item.title && countSourceScriptChars(item.title) >= 4) {
    return true;
  }

  return false;
}
