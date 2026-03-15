"use client";

import { useState } from "react";
import { getArticleDek, getAttributionName, getDisplayBodyText, getDisplayTitle, getLanguageLabel, getPreferredArticleImageUrl, getSourceDisplayName, getSourceDomain, getSourceFaviconUrl, hasEnglishTranslation } from "@/lib/content-display";
import { parseBodyContent } from "@/lib/content-parser";
import { formatFullDate } from "@/lib/format";
import type { DetailItem } from "@/lib/db/types";
import { MediaRenderer } from "./media-renderer";
import { JsonCodeBlock } from "./json-code-block";
import { MediaLightbox } from "./media-lightbox";

type CardType = "tweet" | "thread" | "article" | "art";

interface DetailContentProps {
  item: DetailItem;
  cardType: CardType;
}

const accentColors: Record<CardType, string> = {
  tweet: "var(--accent-tweet)",
  thread: "var(--accent-thread)",
  article: "var(--accent-article)",
  art: "var(--accent-art)",
};

function BodySegments({ bodyText }: { bodyText: string }) {
  const { segments } = parseBodyContent(bodyText);
  return (
    <>
      {segments.map((segment, i) => {
        if (segment.type === "text") {
          return (
            <div
              key={i}
              className="whitespace-pre-wrap text-base leading-[1.75] text-[#cdc4b7]"
            >
              {segment.content}
            </div>
          );
        }
        if (segment.type === "json") {
          return <JsonCodeBlock key={i} code={segment.content} />;
        }
        if (segment.type === "code") {
          return (
            <div
              key={i}
              className="overflow-x-auto rounded-[18px] border border-[#d6c9b214] bg-[#0f141b] p-5 font-mono text-sm text-[#b4ab9d]"
            >
              <pre className="m-0 whitespace-pre-wrap">{segment.content}</pre>
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

function splitReadableParagraphs(text: string): string[] {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return [];

  const explicitParagraphs = normalized
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (explicitParagraphs.length > 1) {
    return explicitParagraphs;
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 2 && lines.every((line) => line.length < 180)) {
    return lines;
  }

  const sentenceMatches = normalized.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g);
  if (!sentenceMatches || sentenceMatches.length < 3) {
    return [normalized];
  }

  const paragraphs: string[] = [];
  let buffer = "";

  for (const sentence of sentenceMatches.map((part) => part.trim()).filter(Boolean)) {
    const next = buffer ? `${buffer} ${sentence}` : sentence;
    const reachedTargetLength = next.length >= 320;
    const reachedHardLimit = next.length >= 520;

    if (reachedHardLimit || (reachedTargetLength && buffer)) {
      paragraphs.push(buffer || sentence);
      buffer = reachedHardLimit ? sentence : "";
      if (reachedHardLimit) continue;
    }

    if (!buffer) {
      buffer = sentence;
    } else if (buffer !== sentence) {
      buffer = next;
    }
  }

  if (buffer) paragraphs.push(buffer);

  return paragraphs.length > 1 ? paragraphs : [normalized];
}

function ArticleTextSegments({ bodyText }: { bodyText: string }) {
  const { segments } = parseBodyContent(bodyText);

  return (
    <div className="space-y-5">
      {segments.map((segment, i) => {
        if (segment.type === "text") {
          const paragraphs = splitReadableParagraphs(segment.content);

          return (
            <div key={i} className="space-y-5">
              {paragraphs.map((paragraph, paragraphIndex) => (
                <p
                  key={`${i}-${paragraphIndex}`}
                  className="max-w-[72ch] text-[17px] leading-[1.95] text-[#cdc4b7] [text-wrap:pretty]"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          );
        }

        if (segment.type === "json") {
          return <JsonCodeBlock key={i} code={segment.content} />;
        }

        if (segment.type === "code") {
          return (
            <div
              key={i}
              className="overflow-x-auto rounded-[18px] border border-[#d6c9b214] bg-[#0f141b] p-5 font-mono text-sm text-[#b4ab9d]"
            >
              <pre className="m-0 whitespace-pre-wrap">{segment.content}</pre>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripLeadingFigureImage(html: string, imageUrl: string | null): string {
  if (!html || !imageUrl) return html;
  const escapedUrl = escapeRegExp(imageUrl);
  const figurePattern = new RegExp(
    `^\\s*<figure[^>]*>[\\s\\S]*?<img[^>]+src=["']${escapedUrl}["'][^>]*>[\\s\\S]*?<\\/figure>\\s*`,
    "i"
  );
  const paragraphPattern = new RegExp(
    `^\\s*<(p|div)[^>]*>\\s*<img[^>]+src=["']${escapedUrl}["'][^>]*>\\s*<\\/(p|div)>\\s*`,
    "i"
  );
  const imagePattern = new RegExp(
    `^\\s*<img[^>]+src=["']${escapedUrl}["'][^>]*>\\s*`,
    "i"
  );

  return html
    .replace(figurePattern, "")
    .replace(paragraphPattern, "")
    .replace(imagePattern, "")
    .trim();
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function htmlHasStructuredParagraphs(html: string): boolean {
  if (/(<figure\b|<blockquote\b|<pre\b|<table\b)/i.test(html)) return true;
  if (/<ul\b|<ol\b/i.test(html)) {
    const listItems = html.match(/<li\b/gi) || [];
    if (listItems.length >= 2) return true;
  }

  const paragraphLikeBlocks = html.match(/<(p|h[1-6]|li)\b/gi) || [];
  if (paragraphLikeBlocks.length >= 2) return true;

  const explicitBreaks = html.match(/<br\s*\/?>\s*<br\s*\/?>/gi) || [];
  return explicitBreaks.length > 0;
}

function htmlToReadableText(html: string): string {
  return decodeBasicHtmlEntities(
    html
      .replace(/\r\n/g, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|blockquote|figure|figcaption|ul|ol|li|h[1-6]|pre)>/gi, "\n\n")
      .replace(/<li\b[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

function normalizePromptComparisonText(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .toLowerCase();
}

function TagsSection({
  tags,
  cardType,
}: {
  tags: DetailItem["tags"];
  cardType: CardType;
}) {
  if (!tags || tags.length === 0) return null;
  const accent = accentColors[cardType];
  return (
    <div className="flex flex-wrap gap-2 mt-6">
      {tags.map(({ tag }) => (
        <span
          key={tag.id}
          className="rounded-full px-3 py-1 text-xs border"
          style={{
            backgroundColor: `${accent}14`,
            color: accent,
            borderColor: `${accent}26`,
          }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}

function TranslationToggle({
  item,
  titleClassName,
  bodyClassName = "space-y-4",
}: {
  item: DetailItem;
  titleClassName?: string;
  bodyClassName?: string;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const hasTranslation = hasEnglishTranslation(item);
  const displayTitle = getDisplayTitle(item);
  const displayBodyText = getDisplayBodyText(item);
  const title = showOriginal ? (item.title || displayTitle) : displayTitle;
  const bodyText = showOriginal ? (item.body_text || displayBodyText) : displayBodyText;

  if (!hasTranslation) {
    return (
      <>
        {titleClassName && title ? <h1 className={titleClassName}>{title}</h1> : null}
        {bodyText ? (
          <div className={bodyClassName}>
            <BodySegments bodyText={bodyText} />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[18px] border border-[#d6c9b214] bg-[#ffffff05] px-4 py-3">
        <p className="text-[12px] text-[#b4ab9d]">
          Translated from {getLanguageLabel(item.language)}.
        </p>
        <button
          type="button"
          onClick={() => setShowOriginal((value) => !value)}
          className="rounded-full border border-[#d6c9b214] bg-[#0f141b] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f2ede5] transition-colors hover:border-[#d6c9b233] hover:text-white"
        >
          {showOriginal ? "Show English" : "Show original"}
        </button>
      </div>
      {titleClassName && title ? <h1 className={titleClassName}>{title}</h1> : null}
      {bodyText ? (
        <div className={bodyClassName}>
          <BodySegments bodyText={bodyText} />
        </div>
      ) : null}
    </>
  );
}

function AuthorHeader({ item }: { item: DetailItem }) {
  const displayName = item.author_display_name || item.author_handle || "Unknown";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {item.author_avatar_url ? (
          <img
            src={item.author_avatar_url}
            alt={displayName}
            width={48}
            height={48}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#f2ede5]"
            style={{
              background: "linear-gradient(135deg, var(--accent-tweet) 0%, var(--accent-thread) 100%)",
            }}
          >
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-heading text-base font-semibold leading-tight text-[#f2ede5]">
            {displayName}
          </p>
          {item.author_handle && (
            <p className="mt-0.5 truncate text-[13px] leading-tight text-[#a49b8b]">
              @{item.author_handle}
            </p>
          )}
        </div>
      </div>
      {item.posted_at && (
        <p className="flex-shrink-0 text-[12px] text-[#8a8174]">
          {formatFullDate(item.posted_at)}
        </p>
      )}
    </div>
  );
}

function TweetThreadContent({
  item,
  cardType,
  onMediaClick,
}: {
  item: DetailItem;
  cardType: CardType;
  onMediaClick: (index: number) => void;
}) {
  const displayBodyText = getDisplayBodyText(item);
  return (
    <div>
      <AuthorHeader item={item} />
      <div className="my-6 border-t border-[#d6c9b214]" />
      <div className="space-y-4 text-base leading-[1.75] text-[#cdc4b7]">
        {displayBodyText ? <TranslationToggle item={item} bodyClassName="space-y-4" /> : null}
      </div>
      {item.media_items && item.media_items.length > 0 && (
        <div className="mt-6">
          <MediaRenderer
            mediaItems={item.media_items}
            onMediaClick={onMediaClick}
          />
        </div>
      )}
      {item.has_prompt && item.prompt_text && cardType === "art" && (
        <div className="mt-6">
          <p
            className="mb-2 text-[11px] font-semibold text-[#a49b8b]"
            style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            Generation Prompt
          </p>
          <blockquote
            className="rounded-[18px] bg-[#ffffff05] px-4 py-4 text-sm italic text-[#cdc4b7]"
            style={{
              borderLeft: "3px solid var(--accent-art)",
            }}
          >
            <span className="mr-1 text-xl leading-none text-[var(--accent-art)]">&ldquo;</span>
            {item.prompt_text}
          </blockquote>
        </div>
      )}
      <TagsSection tags={item.tags} cardType={cardType} />
    </div>
  );
}

function ArticleContent({
  item,
  onMediaClick,
}: {
  item: DetailItem;
  onMediaClick: (index: number) => void;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const isRssArticle = item.source_platform === "rss";
  const attribution = getAttributionName(item);
  const initials = attribution ? attribution.slice(0, 2).toUpperCase() : "??";
  const displayTitle = getDisplayTitle(item);
  const displayBodyText = getDisplayBodyText(item);
  const translationAvailable = hasEnglishTranslation(item);
  const title = showOriginal ? (item.title || displayTitle) : displayTitle;
  const bodyText = showOriginal ? (item.body_text || displayBodyText) : displayBodyText;
  const sourceName = getSourceDisplayName(item);
  const sourceDomain = getSourceDomain(item);
  const sourceFavicon = getSourceFaviconUrl(item);
  const preferredLeadImageUrl = getPreferredArticleImageUrl(item);
  const articleDek = getArticleDek(item, 320);
  const renderedBodyHtml =
    item.body_html && preferredLeadImageUrl
      ? stripLeadingFigureImage(item.body_html, preferredLeadImageUrl)
      : item.body_html;
  const shouldRenderHtml = !!renderedBodyHtml && htmlHasStructuredParagraphs(renderedBodyHtml);
  const fallbackHtmlText =
    renderedBodyHtml && !shouldRenderHtml ? htmlToReadableText(renderedBodyHtml) : null;

  let domain = "";
  if (item.original_url) {
    try {
      domain = new URL(item.original_url).hostname.replace(/^www\./, "").toUpperCase();
    } catch {
      domain = "";
    }
  }

  const wordCount = item.body_text ? item.body_text.split(/\s+/).length : 0;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));

  return (
    <div>
      {isRssArticle ? (
        <div className="mb-6 rounded-[26px] border border-[rgba(184,148,98,0.18)] bg-[linear-gradient(180deg,rgba(184,148,98,0.08),rgba(255,255,255,0.03))] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {sourceFavicon ? (
                <img
                  src={sourceFavicon}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-10 w-10 flex-shrink-0 rounded-xl bg-[#171d26] p-1"
                />
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f0cf9f]">
                  {sourceName || domain || "RSS"}
                </p>
                {sourceDomain && sourceName && sourceName.toLowerCase() !== sourceDomain.toLowerCase() && (
                  <p className="truncate text-[13px] text-[#988e81]">{sourceDomain}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[rgba(184,148,98,0.22)] bg-[rgba(184,148,98,0.14)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f0cf9f]">
                RSS Archive
              </span>
              {item.original_url && (
                <a
                  href={item.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[#d6c9b214] bg-[#0f141b] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f2ede5] transition-colors hover:border-[#d6c9b233] hover:text-white"
                >
                  Read original
                </a>
              )}
            </div>
          </div>
          {articleDek && (
            <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-[#c8bba7]">
              {articleDek}
            </p>
          )}
        </div>
      ) : domain && (
        <p
          className="text-[12px] text-[--accent-article] font-semibold mb-3"
          style={{ textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent-article)" }}
        >
          {domain}
        </p>
      )}
      {title && (
        <h1 className="mb-4 font-heading text-[28px] font-extrabold leading-tight tracking-tight text-[#f2ede5]">
          {title}
        </h1>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {item.author_avatar_url ? (
          <img
            src={item.author_avatar_url}
            alt={attribution || "Author"}
            width={28}
            height={28}
            className="w-7 h-7 rounded-full object-cover flex-shrink-0"
          />
        ) : attribution ? (
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-[#f2ede5]"
            style={{
              background: "linear-gradient(135deg, var(--accent-article) 0%, #9b7345 100%)",
            }}
          >
            {initials}
          </div>
        ) : null}
        {attribution && (
          <span className="text-[13px] text-[#a49b8b]">{attribution}</span>
        )}
        {(attribution || item.posted_at) && (
          <span className="text-[13px] text-[#8a8174]">&middot;</span>
        )}
        {item.posted_at && (
          <span className="text-[13px] text-[#a49b8b]">
            {formatFullDate(item.posted_at)}
          </span>
        )}
        <span className="text-[13px] text-[#8a8174]">&middot;</span>
        <span className="text-[13px] text-[#a49b8b]">{readMinutes} min read</span>
      </div>
      <div className="my-6 border-t border-[#d6c9b214]" />
      {translationAvailable && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[18px] border border-[#d6c9b214] bg-[#ffffff05] px-4 py-3">
          <p className="text-[12px] text-[#b4ab9d]">
            Translated from {getLanguageLabel(item.language)}.
          </p>
          <button
            type="button"
            onClick={() => setShowOriginal((value) => !value)}
            className="rounded-full border border-[#d6c9b214] bg-[#0f141b] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f2ede5] transition-colors hover:border-[#d6c9b233] hover:text-white"
          >
            {showOriginal ? "Show English" : "Show original"}
          </button>
        </div>
      )}
      {preferredLeadImageUrl ? (
        <div className={`mb-6 ${isRssArticle ? "overflow-hidden rounded-[26px] border border-[#d6c9b214] bg-[#10151c] p-2" : ""}`}>
          <div className="overflow-hidden rounded-[22px] bg-[#10151c]">
            <img
              src={preferredLeadImageUrl}
              alt={title || "Article image"}
              loading="lazy"
              decoding="async"
              className="block max-h-[70vh] w-full object-cover"
            />
          </div>
        </div>
      ) : item.media_items && item.media_items.length > 0 && (
        <div className={`mb-6 ${isRssArticle ? "overflow-hidden rounded-[26px] border border-[#d6c9b214] bg-[#10151c] p-2" : ""}`}>
          <MediaRenderer
            mediaItems={item.media_items}
            onMediaClick={onMediaClick}
          />
        </div>
      )}
      {shouldRenderHtml && renderedBodyHtml && !translationAvailable ? (
        <div
          className="prose prose-invert max-w-none
            prose-headings:font-heading prose-headings:text-[#f2ede5]
            prose-headings:max-w-[18ch]
            prose-h2:mb-4 prose-h2:mt-12 prose-h2:text-[1.7rem] prose-h2:tracking-[-0.04em]
            prose-h3:mb-3 prose-h3:mt-9 prose-h3:text-[1.32rem]
            prose-p:my-6 prose-p:max-w-[72ch] prose-p:text-[#cdc4b7] prose-p:leading-[1.95] prose-p:text-[17px]
            prose-a:text-[var(--accent-article)] prose-a:no-underline hover:prose-a:underline
            prose-strong:text-[#f2ede5]
            prose-code:text-[var(--accent-thread)] prose-code:bg-[#0f141b] prose-code:rounded prose-code:px-1.5 prose-code:py-0.5
            prose-blockquote:my-8 prose-blockquote:rounded-r-[20px] prose-blockquote:border-[var(--accent-article)] prose-blockquote:bg-[#ffffff05] prose-blockquote:px-5 prose-blockquote:py-4 prose-blockquote:text-[#c5baab]
            prose-ul:my-6 prose-ul:max-w-[72ch] prose-ul:text-[#cdc4b7] prose-ol:my-6 prose-ol:max-w-[72ch] prose-ol:text-[#cdc4b7]
            prose-li:my-1.5 prose-li:marker:text-[#b89462]
            prose-hr:my-10 prose-hr:border-[#d6c9b214]
            prose-img:rounded-[20px] prose-img:border prose-img:border-[#d6c9b214]
            prose-figure:my-10 prose-figure:overflow-hidden prose-figure:rounded-[22px] prose-figure:border prose-figure:border-[#d6c9b214] prose-figure:bg-[#ffffff03]
            prose-figcaption:mt-3 prose-figcaption:px-4 prose-figcaption:pb-4 prose-figcaption:text-center prose-figcaption:text-xs prose-figcaption:leading-6 prose-figcaption:text-[#8a8174]"
          dangerouslySetInnerHTML={{ __html: renderedBodyHtml }}
        />
      ) : fallbackHtmlText && !translationAvailable ? (
        <div className="space-y-5">
          <ArticleTextSegments bodyText={fallbackHtmlText} />
        </div>
      ) : bodyText ? (
        <div className="space-y-5">
          <ArticleTextSegments bodyText={bodyText} />
        </div>
      ) : null}
    </div>
  );
}

function ArtContent({
  item,
  onMediaClick,
}: {
  item: DetailItem;
  onMediaClick: (index: number) => void;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const promptTypeLabel =
    item.source_type === "video_prompt" ? "Video Prompt" : "Image Prompt";
  const translationAvailable = hasEnglishTranslation(item);
  const bodyText = showOriginal ? (item.body_text || getDisplayBodyText(item)) : getDisplayBodyText(item);

  const hasJsonInText =
    (item.prompt_text && (item.prompt_text.includes("{") || item.prompt_text.includes("["))) ||
    (item.body_text && (item.body_text.includes("{") || item.body_text.includes("[")));
  const normalizedBody = normalizePromptComparisonText(bodyText);
  const normalizedPrompt = normalizePromptComparisonText(item.prompt_text);
  const promptIsDuplicatedInBody =
    !!normalizedBody &&
    !!normalizedPrompt &&
    (normalizedBody === normalizedPrompt ||
      normalizedBody.includes(normalizedPrompt) ||
      normalizedPrompt.includes(normalizedBody));

  return (
    <div>
      <span
        className="inline-block text-[11px] font-semibold rounded-full px-3 py-1 mb-4 border"
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--accent-art)",
          backgroundColor: "rgba(182,111,120,0.12)",
          borderColor: "rgba(182,111,120,0.18)",
        }}
      >
        {promptTypeLabel}
      </span>
      {translationAvailable && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[18px] border border-[#d6c9b214] bg-[#ffffff05] px-4 py-3">
          <p className="text-[12px] text-[#b4ab9d]">
            Translated from {getLanguageLabel(item.language)}.
          </p>
          <button
            type="button"
            onClick={() => setShowOriginal((value) => !value)}
            className="rounded-full border border-[#d6c9b214] bg-[#0f141b] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f2ede5] transition-colors hover:border-[#d6c9b233] hover:text-white"
          >
            {showOriginal ? "Show English" : "Show original"}
          </button>
        </div>
      )}
      {item.media_items && item.media_items.length > 0 && (
        <div className="mb-6">
          <MediaRenderer
            mediaItems={item.media_items}
            onMediaClick={onMediaClick}
          />
        </div>
      )}
      {bodyText && (
        <div className="mb-6 space-y-4 text-base leading-[1.75] text-[#cdc4b7]">
          <BodySegments bodyText={bodyText} />
        </div>
      )}
      {item.has_prompt && item.prompt_text && !promptIsDuplicatedInBody && (
        <div className="mb-6">
          <p
            className="mb-2 text-[11px] font-semibold text-[#a49b8b]"
            style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            Generation Prompt
          </p>
          <blockquote
            className="rounded-[18px] bg-[#ffffff05] px-4 py-4 text-sm italic text-[#cdc4b7]"
            style={{
              borderLeft: "3px solid var(--accent-art)",
            }}
          >
            <span className="mr-1 text-xl leading-none text-[var(--accent-art)]">&ldquo;</span>
            {hasJsonInText ? (
              <BodySegments bodyText={item.prompt_text} />
            ) : (
              item.prompt_text
            )}
          </blockquote>
        </div>
      )}
      <TagsSection tags={item.tags} cardType="art" />
    </div>
  );
}

export function DetailContent({ item, cardType }: DetailContentProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleMediaClick = (index: number) => {
    setLightboxIndex(index);
  };

  const handleCloseLightbox = () => {
    setLightboxIndex(null);
  };

  return (
    <>
      <div>
        {(cardType === "tweet" || cardType === "thread") && (
          <TweetThreadContent
            item={item}
            cardType={cardType}
            onMediaClick={handleMediaClick}
          />
        )}
        {cardType === "article" && (
          <>
            <ArticleContent item={item} onMediaClick={handleMediaClick} />
            <TagsSection tags={item.tags} cardType={cardType} />
          </>
        )}
        {cardType === "art" && (
          <ArtContent item={item} onMediaClick={handleMediaClick} />
        )}
      </div>

      {lightboxIndex !== null && item.media_items && item.media_items.length > 0 && (
        <MediaLightbox
          mediaItems={item.media_items}
          initialIndex={lightboxIndex}
          onClose={handleCloseLightbox}
        />
      )}
    </>
  );
}
