"use client";

import { useState } from "react";
import { getDisplayBodyText, getDisplayTitle, getLanguageLabel, hasEnglishTranslation } from "@/lib/content-display";
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
  const displayName = item.author_display_name || item.author_handle || null;
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : "??";
  const displayTitle = getDisplayTitle(item);
  const displayBodyText = getDisplayBodyText(item);
  const translationAvailable = hasEnglishTranslation(item);
  const title = showOriginal ? (item.title || displayTitle) : displayTitle;
  const bodyText = showOriginal ? (item.body_text || displayBodyText) : displayBodyText;

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
      {domain && (
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
      <div className="flex items-center gap-2 mb-2">
        {item.author_avatar_url ? (
          <img
            src={item.author_avatar_url}
            alt={displayName || "Author"}
            width={28}
            height={28}
            className="w-7 h-7 rounded-full object-cover flex-shrink-0"
          />
        ) : displayName ? (
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-[#f2ede5]"
            style={{
              background: "linear-gradient(135deg, var(--accent-article) 0%, #9b7345 100%)",
            }}
          >
            {initials}
          </div>
        ) : null}
        {displayName && (
          <span className="text-[13px] text-[#a49b8b]">{displayName}</span>
        )}
        {(displayName || item.posted_at) && (
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
      {item.media_items && item.media_items.length > 0 && (
        <div className="mb-6">
          <MediaRenderer
            mediaItems={item.media_items}
            onMediaClick={onMediaClick}
          />
        </div>
      )}
      {item.body_html && !translationAvailable ? (
        <div
          className="prose prose-invert prose-sm max-w-none
            prose-headings:font-heading prose-headings:text-[#f2ede5]
            prose-p:text-[#cdc4b7] prose-p:leading-[1.75]
            prose-a:text-[var(--accent-article)] prose-a:no-underline hover:prose-a:underline
            prose-strong:text-[#f2ede5]
            prose-code:text-[var(--accent-thread)] prose-code:bg-[#0f141b] prose-code:rounded prose-code:px-1
            prose-blockquote:border-[var(--accent-article)] prose-blockquote:text-[#b4ab9d]
            prose-ul:text-[#cdc4b7] prose-ol:text-[#cdc4b7]
            prose-hr:border-[#d6c9b214]
            prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: item.body_html }}
        />
      ) : bodyText ? (
        <div className="space-y-4">
          <BodySegments bodyText={bodyText} />
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
  const promptTypeLabel =
    item.source_type === "video_prompt" ? "Video Prompt" : "Image Prompt";

  const hasJsonInText =
    (item.prompt_text && (item.prompt_text.includes("{") || item.prompt_text.includes("["))) ||
    (item.body_text && (item.body_text.includes("{") || item.body_text.includes("[")));
  const normalizedBody = normalizePromptComparisonText(item.body_text);
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
      {item.body_text && (
        <div className="mb-6 space-y-4 text-base leading-[1.75] text-[#cdc4b7]">
          <BodySegments bodyText={item.body_text} />
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
      {item.media_items && item.media_items.length > 0 && (
        <div className="mb-6">
          <MediaRenderer
            mediaItems={item.media_items}
            onMediaClick={onMediaClick}
          />
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
