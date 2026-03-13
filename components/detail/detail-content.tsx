"use client";

import { useState } from "react";
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
  tweet: "#22d3ee",
  thread: "#a78bfa",
  article: "#fb923c",
  art: "#ec4899",
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
              className="whitespace-pre-wrap text-base leading-[1.7] text-[#d8d8e8]"
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
              className="bg-[#0c0c14] rounded-xl p-5 font-mono text-sm text-[#8888aa] overflow-x-auto"
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
            className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%)",
            }}
          >
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-heading font-semibold text-base text-[#f0f0f5] truncate leading-tight">
            {displayName}
          </p>
          {item.author_handle && (
            <p className="text-[13px] text-[#8888aa] truncate leading-tight mt-0.5">
              @{item.author_handle}
            </p>
          )}
        </div>
      </div>
      {item.posted_at && (
        <p className="text-[12px] text-[#555566] flex-shrink-0">
          {formatFullDate(item.posted_at)}
        </p>
      )}
    </div>
  );
}

function TweetThreadContent({
  item,
  cardType,
  onImageClick,
}: {
  item: DetailItem;
  cardType: CardType;
  onImageClick: (index: number) => void;
}) {
  return (
    <div>
      <AuthorHeader item={item} />
      <div className="border-t border-[rgba(255,255,255,0.07)] my-6" />
      <div className="space-y-4 text-base leading-[1.7] text-[#d8d8e8]">
        {item.body_text ? (
          <BodySegments bodyText={item.body_text} />
        ) : null}
      </div>
      {item.media_items && item.media_items.length > 0 && (
        <div className="mt-6">
          <MediaRenderer
            mediaItems={item.media_items}
            onImageClick={onImageClick}
          />
        </div>
      )}
      {item.has_prompt && item.prompt_text && cardType === "art" && (
        <div className="mt-6">
          <p
            className="text-[11px] text-[#8888aa] mb-2 font-semibold"
            style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            Generation Prompt
          </p>
          <blockquote
            className="pl-4 py-3 rounded-r-lg text-sm text-[#d8d8e8] italic"
            style={{
              borderLeft: "3px solid #ec4899",
              background: "rgba(236,72,153,0.05)",
            }}
          >
            <span className="text-[#ec4899] text-xl leading-none mr-1">&ldquo;</span>
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
  onImageClick,
}: {
  item: DetailItem;
  onImageClick: (index: number) => void;
}) {
  const displayName = item.author_display_name || item.author_handle || null;
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : "??";

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
          style={{ textTransform: "uppercase", letterSpacing: "0.1em", color: "#fb923c" }}
        >
          {domain}
        </p>
      )}
      {item.title && (
        <h1 className="font-heading font-extrabold text-[28px] leading-tight tracking-tight mb-4 text-[#f0f0f5]">
          {item.title}
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
            className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #fb923c 0%, #f97316 100%)",
            }}
          >
            {initials}
          </div>
        ) : null}
        {displayName && (
          <span className="text-[13px] text-[#8888aa]">{displayName}</span>
        )}
        {(displayName || item.posted_at) && (
          <span className="text-[#555566] text-[13px]">&middot;</span>
        )}
        {item.posted_at && (
          <span className="text-[13px] text-[#8888aa]">
            {formatFullDate(item.posted_at)}
          </span>
        )}
        <span className="text-[#555566] text-[13px]">&middot;</span>
        <span className="text-[13px] text-[#8888aa]">{readMinutes} min read</span>
      </div>
      <div className="border-t border-[rgba(255,255,255,0.07)] my-6" />
      {item.media_items && item.media_items.length > 0 && (
        <div className="mb-6">
          <MediaRenderer
            mediaItems={item.media_items}
            onImageClick={onImageClick}
          />
        </div>
      )}
      {item.body_html ? (
        <div
          className="prose prose-invert prose-sm max-w-none
            prose-headings:font-heading prose-headings:text-[#f0f0f5]
            prose-p:text-[#d8d8e8] prose-p:leading-[1.7]
            prose-a:text-[#fb923c] prose-a:no-underline hover:prose-a:underline
            prose-strong:text-[#f0f0f5]
            prose-code:text-[#a78bfa] prose-code:bg-[#0c0c14] prose-code:rounded prose-code:px-1
            prose-blockquote:border-[#fb923c] prose-blockquote:text-[#8888aa]
            prose-ul:text-[#d8d8e8] prose-ol:text-[#d8d8e8]
            prose-hr:border-[rgba(255,255,255,0.07)]
            prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: item.body_html }}
        />
      ) : item.body_text ? (
        <div className="space-y-4">
          <BodySegments bodyText={item.body_text} />
        </div>
      ) : null}
    </div>
  );
}

function ArtContent({
  item,
  onImageClick,
}: {
  item: DetailItem;
  onImageClick: (index: number) => void;
}) {
  const promptTypeLabel =
    item.source_type === "video_prompt" ? "Video Prompt" : "Image Prompt";

  const hasJsonInText =
    (item.prompt_text && (item.prompt_text.includes("{") || item.prompt_text.includes("["))) ||
    (item.body_text && (item.body_text.includes("{") || item.body_text.includes("[")));

  return (
    <div>
      <span
        className="inline-block text-[11px] font-semibold rounded-full px-3 py-1 mb-4 border"
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#ec4899",
          backgroundColor: "rgba(236,72,153,0.1)",
          borderColor: "rgba(236,72,153,0.2)",
        }}
      >
        {promptTypeLabel}
      </span>
      {item.body_text && (
        <div className="space-y-4 mb-6 text-base leading-[1.7] text-[#d8d8e8]">
          <BodySegments bodyText={item.body_text} />
        </div>
      )}
      {item.has_prompt && item.prompt_text && (
        <div className="mb-6">
          <p
            className="text-[11px] text-[#8888aa] mb-2 font-semibold"
            style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            Generation Prompt
          </p>
          <blockquote
            className="pl-4 py-3 rounded-r-lg text-sm text-[#d8d8e8] italic"
            style={{
              borderLeft: "3px solid #ec4899",
              background: "rgba(236,72,153,0.05)",
            }}
          >
            <span className="text-[#ec4899] text-xl leading-none mr-1">&ldquo;</span>
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
            onImageClick={onImageClick}
          />
        </div>
      )}
      <TagsSection tags={item.tags} cardType="art" />
    </div>
  );
}

export function DetailContent({ item, cardType }: DetailContentProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleImageClick = (index: number) => {
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
            onImageClick={handleImageClick}
          />
        )}
        {cardType === "article" && (
          <>
            <ArticleContent item={item} onImageClick={handleImageClick} />
            <TagsSection tags={item.tags} cardType={cardType} />
          </>
        )}
        {cardType === "art" && (
          <ArtContent item={item} onImageClick={handleImageClick} />
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
