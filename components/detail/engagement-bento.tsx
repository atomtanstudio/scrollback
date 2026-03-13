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

const borderGradients: Record<CardType, string> = {
  tweet: "border-gradient-tweet",
  thread: "border-gradient-thread",
  article: "border-gradient-article",
  art: "border-gradient-art",
};

const cardGradients: Record<CardType, string> = {
  tweet: "card-gradient-tweet",
  thread: "card-gradient-thread",
  article: "card-gradient-article",
  art: "card-gradient-art",
};

const accentColors: Record<CardType, string> = {
  tweet: "#22d3ee",
  thread: "#a78bfa",
  article: "#fb923c",
  art: "#ec4899",
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
    <div className={`rounded-[14px] p-px ${borderGradients[cardType]}`}>
      <div className={`rounded-[13px] p-5 ${cardGradients[cardType]}`}>
        <p
          className="font-heading font-semibold text-[13px] text-[#8888aa] mb-4"
          style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          ENGAGEMENT
        </p>

        <div className="grid grid-cols-2 gap-3">
          {/* Views */}
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-4 text-center">
            <div className="flex justify-center mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <p className="font-heading font-bold text-[22px] text-[#f0f0f5] leading-none">
              {formatNumber(views)}
            </p>
            <p className="text-[11px] text-[#8888aa] mt-1" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Views
            </p>
          </div>

          {/* Likes */}
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-4 text-center">
            <div className="flex justify-center mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <p className="font-heading font-bold text-[22px] text-[#f0f0f5] leading-none">
              {formatNumber(likes)}
            </p>
            <p className="text-[11px] text-[#8888aa] mt-1" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Likes
            </p>
          </div>

          {/* Retweets */}
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-4 text-center">
            <div className="flex justify-center mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </div>
            <p className="font-heading font-bold text-[22px] text-[#f0f0f5] leading-none">
              {formatNumber(retweets)}
            </p>
            <p className="text-[11px] text-[#8888aa] mt-1" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Retweets
            </p>
          </div>

          {/* Replies */}
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-[12px] p-4 text-center">
            <div className="flex justify-center mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="font-heading font-bold text-[22px] text-[#f0f0f5] leading-none">
              {formatNumber(replies)}
            </p>
            <p className="text-[11px] text-[#8888aa] mt-1" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Replies
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
