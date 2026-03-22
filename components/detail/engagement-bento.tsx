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

export function EngagementBento({
  views,
  likes,
  retweets,
  replies,
}: EngagementBentoProps) {
  const stats = [
    { label: "Views", value: views },
    { label: "Likes", value: likes },
    { label: "Retweets", value: retweets },
    { label: "Replies", value: replies },
  ].filter((s) => s.value != null && s.value !== 0);

  if (stats.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[16px] border border-[#d6c9b214] bg-[#ffffff08] px-4 py-3">
      {stats.map((stat, i) => (
        <span key={stat.label} className="flex items-center gap-1.5 text-[13px]">
          <span className="font-semibold text-[#f2ede5]">{formatNumber(stat.value)}</span>
          <span className="text-[#8a8174]">{stat.label}</span>
          {i < stats.length - 1 && <span className="ml-2.5 text-[#d6c9b214]">·</span>}
        </span>
      ))}
    </div>
  );
}
