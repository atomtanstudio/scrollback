type TranslatableContent = {
  title?: string | null;
  body_text?: string | null;
  translated_title?: string | null;
  translated_body_text?: string | null;
  language?: string | null;
};

const LANGUAGE_LABELS: Record<string, string> = {
  ar: "Arabic",
  de: "German",
  en: "English",
  es: "Spanish",
  fr: "French",
  hi: "Hindi",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  pt: "Portuguese",
  ru: "Russian",
  zh: "Chinese",
};

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getDisplayTitle(item: TranslatableContent): string {
  return clean(item.translated_title) || clean(item.title);
}

export function getDisplayBodyText(item: TranslatableContent): string {
  return clean(item.translated_body_text) || clean(item.body_text);
}

export function hasEnglishTranslation(item: TranslatableContent): boolean {
  const translatedTitle = clean(item.translated_title);
  const translatedBody = clean(item.translated_body_text);
  const originalTitle = clean(item.title);
  const originalBody = clean(item.body_text);

  if (!translatedTitle && !translatedBody) return false;
  if (translatedTitle && translatedTitle !== originalTitle) return true;
  if (translatedBody && translatedBody !== originalBody) return true;
  return false;
}

export function getLanguageLabel(language: string | null | undefined): string {
  const code = clean(language).toLowerCase();
  if (!code) return "another language";
  return LANGUAGE_LABELS[code] || code.toUpperCase();
}
