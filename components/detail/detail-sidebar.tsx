"use client";
import { useEffect, useMemo, useState } from "react";
import { Pin, PinOff } from "lucide-react";
import { formatFullDate } from "@/lib/format";
import type { DetailItem } from "@/lib/db/types";
import type { PinnedFilter } from "@/lib/pinned-filters";
import { EngagementBento } from "./engagement-bento";
import { AuthorCard } from "./author-card";
import { AdminActions } from "@/components/detail/admin-actions";

type CardType = "tweet" | "thread" | "article" | "art";

interface DetailSidebarProps {
  item: DetailItem;
  cardType: CardType;
  isAuthed?: boolean;
}

const accentColors: Record<CardType, string> = {
  tweet: "var(--accent-tweet)",
  thread: "var(--accent-thread)",
  article: "var(--accent-article)",
  art: "var(--accent-art)",
};

interface TocHeading {
  id: string;
  text: string;
  level: number;
}

function extractH2Headings(html: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const regex = /<h([23])[^>]*(?:id="([^"]*)")?[^>]*>(.*?)<\/h[23]>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const id = match[2] || "";
    const rawText = match[3].replace(/<[^>]+>/g, "").trim();
    if (rawText) {
      headings.push({ id, text: rawText, level });
    }
  }
  return headings;
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff08] p-5">
      <p
        className="mb-3 font-heading text-[13px] font-semibold text-[#a49b8b]"
        style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}


function TableOfContents({ html }: { html: string }) {
  const headings = extractH2Headings(html);
  if (headings.length < 2) return null;

  return (
    <SidebarSection title="Contents">
      <nav className="space-y-1">
        {headings.map((heading, i) => (
          <a
            key={i}
            href={heading.id ? `#${heading.id}` : undefined}
            className="block py-0.5 text-[13px] leading-snug text-[#b4ab9d] transition-colors hover:text-[#f2ede5]"
            style={heading.level === 3 ? { paddingLeft: "12px" } : undefined}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </SidebarSection>
  );
}

function AiSummaryCard({ summary }: { summary: string }) {
  return (
    <SidebarSection title="AI Summary">
      <p className="text-sm leading-relaxed text-[#cdc4b7]">{summary}</p>
    </SidebarSection>
  );
}

function TagsAndCategories({
  tags,
  categories,
  cardType,
  isAuthed,
}: {
  tags: DetailItem["tags"];
  categories: DetailItem["categories"];
  cardType: CardType;
  isAuthed: boolean;
}) {
  const hasTags = tags && tags.length > 0;
  const hasCategories = categories && categories.length > 0;
  const accent = accentColors[cardType];
  const [pinnedFilters, setPinnedFilters] = useState<PinnedFilter[]>([]);
  const [pendingValue, setPendingValue] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;
    void fetch("/api/pinned-filters")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.filters) {
          setPinnedFilters(data.filters);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  const pinnedValues = useMemo(
    () => new Set(pinnedFilters.filter((filter) => filter.kind === "tag").map((filter) => filter.value)),
    [pinnedFilters]
  );

  const togglePinnedTopic = async (filter: PinnedFilter) => {
    if (!isAuthed) return;
    const method = pinnedValues.has(filter.value) ? "DELETE" : "POST";
    setPendingValue(filter.value);
    try {
      const res = await fetch("/api/pinned-filters", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filter),
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data?.filters) {
        setPinnedFilters(data.filters);
      }
    } finally {
      setPendingValue(null);
    }
  };

  const renderTopicChip = (
    filter: PinnedFilter,
    href: string,
    style: { backgroundColor: string; color: string; borderColor: string },
    key: string
  ) => {
    const isPinned = pinnedValues.has(filter.value);
    const isPending = pendingValue === filter.value;

    return (
      <div
        key={key}
        className="inline-flex items-center gap-1.5 rounded-full border pr-1"
        style={style}
      >
        <a
          href={href}
          className="rounded-full px-3 py-1 text-[11px] transition-opacity hover:opacity-80"
        >
          {filter.label}
        </a>
        {isAuthed && (
          <button
            type="button"
            onClick={() => void togglePinnedTopic(filter)}
            disabled={isPending}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0f141b33] text-current transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={`${isPinned ? "Unpin" : "Pin"} ${filter.label}`}
            title={`${isPinned ? "Unpin" : "Pin"} ${filter.label}`}
          >
            {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    );
  };

  if (!hasTags && !hasCategories) return null;

  return (
    <SidebarSection title="Tags">
      <div className="flex flex-wrap gap-2">
        {hasCategories &&
          categories.map(({ category }) =>
            renderTopicChip(
              { kind: "tag", value: category.slug, label: category.name },
              `/tag/${encodeURIComponent(category.slug)}`,
              {
                backgroundColor: `${accent}18`,
                color: accent,
                borderColor: `${accent}28`,
              },
              `cat-${category.id}`
            )
          )}
        {hasTags &&
          tags.map(({ tag }) =>
            renderTopicChip(
              { kind: "tag", value: tag.slug, label: tag.name },
              `/tag/${encodeURIComponent(tag.slug)}`,
              {
                backgroundColor: `${accent}0a`,
                color: accent,
                borderColor: `${accent}18`,
              },
              `tag-${tag.id}`
            )
          )}
      </div>
    </SidebarSection>
  );
}

export function DetailSidebar({ item, cardType, isAuthed = false }: DetailSidebarProps) {
  const accent = accentColors[cardType];
  const sourceTypeLabel = item.source_type.charAt(0).toUpperCase() + item.source_type.slice(1);

  return (
    <div className="sticky top-6 flex flex-col gap-5">
      {item.ai_summary && <AiSummaryCard summary={item.ai_summary} />}

      <EngagementBento
        views={item.views}
        likes={item.likes}
        retweets={item.retweets}
        replies={item.replies}
        cardType={cardType}
      />

      <AuthorCard
        authorHandle={item.author_handle}
        authorDisplayName={item.author_display_name}
        authorAvatarUrl={item.author_avatar_url}
        originalUrl={item.original_url}
        sourceType={item.source_type}
        sourcePlatform={item.source_platform}
        sourceLabel={item.source_label}
        sourceDomain={item.source_domain}
      />

      {isAuthed && <AdminActions item={item} />}

      <TagsAndCategories tags={item.tags} categories={item.categories} cardType={cardType} isAuthed={isAuthed} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-[11px] text-[#7d7569]">
        {item.source_platform === "rss" && item.source_label && (
          <span>{item.source_label}</span>
        )}
        <span style={{ color: accent }}>{sourceTypeLabel}</span>
        {item.posted_at && <span>{formatFullDate(item.posted_at)}</span>}
        {item.created_at && item.posted_at !== item.created_at && (
          <span>Saved {formatFullDate(item.created_at)}</span>
        )}
      </div>

      {cardType === "article" && item.body_html && <TableOfContents html={item.body_html} />}
    </div>
  );
}
