"use client";

import { formatFullDate } from "@/lib/format";
import type { DetailItem } from "@/lib/db/types";
import { EngagementBento } from "./engagement-bento";
import { AuthorCard } from "./author-card";

type CardType = "tweet" | "thread" | "article" | "art";

interface DetailSidebarProps {
  item: DetailItem;
  cardType: CardType;
}

const accentColors: Record<CardType, string> = {
  tweet: "#22d3ee",
  thread: "#a78bfa",
  article: "#fb923c",
  art: "#ec4899",
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

function MetaRow({
  label,
  value,
  accentColor,
  isLast = false,
}: {
  label: string;
  value: string;
  accentColor?: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center text-xs py-1.5 ${
        !isLast ? "border-b border-[rgba(255,255,255,0.07)]" : ""
      }`}
    >
      <span className="text-[#555566]">{label}</span>
      <span
        className="text-[#8888aa]"
        style={accentColor ? { color: accentColor } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function TableOfContents({ html }: { html: string }) {
  const headings = extractH2Headings(html);
  if (headings.length < 2) return null;

  return (
    <div className="bg-[var(--surface)] border border-[hsl(var(--border))] rounded-[14px] p-4 px-5">
      <p
        className="font-heading font-semibold text-[13px] text-[#8888aa] mb-3"
        style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
      >
        Contents
      </p>
      <nav className="space-y-1">
        {headings.map((heading, i) => (
          <a
            key={i}
            href={heading.id ? `#${heading.id}` : undefined}
            className="block text-[13px] text-[#8888aa] hover:text-[#f0f0f5] transition-colors py-0.5 leading-snug"
            style={heading.level === 3 ? { paddingLeft: "12px" } : undefined}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </div>
  );
}

export function DetailSidebar({ item, cardType }: DetailSidebarProps) {
  const accent = accentColors[cardType];
  const sourceTypeLabel =
    item.source_type.charAt(0).toUpperCase() + item.source_type.slice(1);

  return (
    <div className="sticky top-6 flex flex-col gap-5">
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
      />

      <div className="bg-[var(--surface)] border border-[hsl(var(--border))] rounded-[14px] p-4 px-5">
        <p
          className="font-heading font-semibold text-[13px] text-[#8888aa] mb-3"
          style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          Meta
        </p>
        <MetaRow
          label="Posted"
          value={item.posted_at ? formatFullDate(item.posted_at) : "Unknown"}
        />
        <MetaRow
          label="Captured"
          value={item.created_at ? formatFullDate(item.created_at) : "Unknown"}
        />
        <MetaRow
          label="Type"
          value={sourceTypeLabel}
          accentColor={accent}
          isLast
        />
      </div>

      {cardType === "article" && item.body_html && (
        <TableOfContents html={item.body_html} />
      )}
    </div>
  );
}
