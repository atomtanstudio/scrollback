type TranslatableContent = {
  title?: string | null;
  body_text?: string | null;
  translated_title?: string | null;
  translated_body_text?: string | null;
  language?: string | null;
  author_display_name?: string | null;
  author_handle?: string | null;
  source_platform?: string | null;
  source_label?: string | null;
  source_domain?: string | null;
  original_url?: string | null;
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

export function getAttributionName(item: TranslatableContent): string | null {
  const authorDisplayName = clean(item.author_display_name);
  const authorHandle = clean(item.author_handle);
  if (authorDisplayName) return authorDisplayName;
  if (authorHandle) return authorHandle;

  if (clean(item.source_platform).toLowerCase() === "rss") {
    const sourceLabel = clean(item.source_label);
    if (sourceLabel) return sourceLabel;

    const sourceDomain = clean(item.source_domain);
    if (sourceDomain) return sourceDomain;

    try {
      return item.original_url ? new URL(item.original_url).hostname.replace(/^www\./, "") : null;
    } catch {
      return null;
    }
  }

  return null;
}
