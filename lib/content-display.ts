type TranslatableContent = {
  title?: string | null;
  body_text?: string | null;
  body_html?: string | null;
  translated_title?: string | null;
  translated_body_text?: string | null;
  language?: string | null;
  ai_summary?: string | null;
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

function stripUrls(value: string): string {
  return value.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
}

function getFirstImageSrcFromHtml(html: string): string | null {
  const match = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  return match?.[1]?.trim() || null;
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

export function getSourceDomain(item: TranslatableContent): string | null {
  const sourceDomain = clean(item.source_domain);
  if (sourceDomain) return sourceDomain;

  try {
    return item.original_url ? new URL(item.original_url).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

export function getSourceDisplayName(item: TranslatableContent): string | null {
  const sourceLabel = clean(item.source_label);
  if (sourceLabel) return sourceLabel;
  return getSourceDomain(item);
}

export function getSourceFaviconUrl(item: TranslatableContent): string | null {
  const domain = getSourceDomain(item);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

export function getPreferredArticleImageUrl(item: TranslatableContent): string | null {
  const bodyHtml = clean(item.body_html);
  if (clean(item.source_platform).toLowerCase() === "rss" && bodyHtml) {
    const inlineImage = getFirstImageSrcFromHtml(bodyHtml);
    if (inlineImage) return inlineImage;
  }
  return null;
}

export function getArticleDek(item: TranslatableContent, max = 220): string {
  const summary = stripUrls(clean(item.ai_summary));
  if (summary) return summary.length > max ? `${summary.slice(0, max - 1).trimEnd()}…` : summary;

  const body = stripUrls(getDisplayBodyText(item));
  if (!body) return "";
  return body.length > max ? `${body.slice(0, max - 1).trimEnd()}…` : body;
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
