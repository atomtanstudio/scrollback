"use client";

import { formatNumber } from "@/lib/format";

type CardType = "tweet" | "thread" | "article" | "art";

interface EngagementBentoProps {
  views: number | null;
  likes: number | null;
  retweets: number | null;
  replies: number | null;
  cardType: CardType;
}

const accentColors: Record<CardType, string> = {
  tweet: "var(--accent-tweet)",
  thread: "var(--accent-thread)",
  article: "var(--accent-article)",
  art: "var(--accent-art)",
};

export function EngagementBento({
  views,
  likes,
  retweets,
  replies,
  cardType,
}: EngagementBentoProps) {
  // Don't render if all stats are null/0
  const hasAnyStats =
    (views != null && views !== 0) ||
    (likes != null && likes !== 0) ||
    (retweets != null && retweets !== 0) ||
    (replies != null && replies !== 0);

  if (!hasAnyStats) return null;

  const accent = accentColors[cardType];

  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff08] p-5">
      <p
        className="mb-4 font-heading text-[13px] font-semibold text-[#a49b8b]"
        style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
      >
          ENGAGEMENT
      </p>

      <div className="grid grid-cols-2 gap-3">
          {/* Views */}
          <div className="rounded-[16px] border border-[#d6c9b214] bg-[#ffffff05] p-4 text-center">
            <div className="flex justify-center mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <p className="font-heading font-bold text-[22px] leading-none text-[#f2ede5]">
              {formatNumber(views)}
            </p>
            <p className="mt-1 text-[11px] text-[#8a8174]" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Views
            </p>
          </div>

          {/* Likes */}
          <div className="rounded-[16px] border border-[#d6c9b214] bg-[#ffffff05] p-4 text-center">
            <div className="flex justify-center mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-art)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <p className="font-heading font-bold text-[22px] leading-none text-[#f2ede5]">
              {formatNumber(likes)}
            </p>
            <p className="mt-1 text-[11px] text-[#8a8174]" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Likes
            </p>
          </div>

          {/* Retweets */}
          <div className="rounded-[16px] border border-[#d6c9b214] bg-[#ffffff05] p-4 text-center">
            <div className="flex justify-center mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </div>
            <p className="font-heading font-bold text-[22px] leading-none text-[#f2ede5]">
              {formatNumber(retweets)}
            </p>
            <p className="mt-1 text-[11px] text-[#8a8174]" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Retweets
            </p>
          </div>

          {/* Replies */}
          <div className="rounded-[16px] border border-[#d6c9b214] bg-[#ffffff05] p-4 text-center">
            <div className="flex justify-center mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="font-heading font-bold text-[22px] leading-none text-[#f2ede5]">
              {formatNumber(replies)}
            </p>
            <p className="mt-1 text-[11px] text-[#8a8174]" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Replies
            </p>
          </div>
      </div>
    </div>
  );
}
