"use client";

import { formatFullDate } from "@/lib/format";
import type { DetailItem } from "@/lib/db/types";
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
      className={`flex items-center justify-between py-1.5 text-xs ${!isLast ? "border-b border-[#d6c9b214]" : ""}`}
    >
      <span className="text-[#8a8174]">{label}</span>
      <span className="text-[#cdc4b7]" style={accentColor ? { color: accentColor } : undefined}>
        {value}
      </span>
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

function TagsCard({ tags, cardType }: { tags: DetailItem["tags"]; cardType: CardType }) {
  if (!tags || tags.length === 0) return null;
  const accent = accentColors[cardType];

  return (
    <SidebarSection title="Tags">
      <div className="flex flex-wrap gap-2">
        {tags.map(({ tag }) => (
          <span
            key={tag.id}
            className="rounded-full border px-3 py-1 text-[11px]"
            style={{
              backgroundColor: `${accent}14`,
              color: accent,
              borderColor: `${accent}22`,
            }}
          >
            {tag.name}
          </span>
        ))}
      </div>
    </SidebarSection>
  );
}

function CategoriesCard({
  categories,
  cardType,
}: {
  categories: DetailItem["categories"];
  cardType: CardType;
}) {
  if (!categories || categories.length === 0) return null;
  const accent = accentColors[cardType];

  return (
    <SidebarSection title="Categories">
      <div className="space-y-2">
        {categories.map(({ category }) => (
          <div key={category.id} className="flex items-center gap-2 text-[13px]">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: accent }} />
            <span className="text-[#cdc4b7]">{category.name}</span>
          </div>
        ))}
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
      />

      {isAuthed && <AdminActions item={item} />}

      <TagsCard tags={item.tags} cardType={cardType} />
      <CategoriesCard categories={item.categories} cardType={cardType} />

      <SidebarSection title="Meta">
        <MetaRow label="Posted" value={item.posted_at ? formatFullDate(item.posted_at) : "Unknown"} />
        <MetaRow label="Captured" value={item.created_at ? formatFullDate(item.created_at) : "Unknown"} />
        <MetaRow label="Type" value={sourceTypeLabel} accentColor={accent} isLast />
      </SidebarSection>

      {cardType === "article" && item.body_html && <TableOfContents html={item.body_html} />}
    </div>
  );
}
