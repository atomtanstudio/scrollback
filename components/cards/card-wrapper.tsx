"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import Link from "next/link";

type CardType = "tweet" | "thread" | "article" | "art";

const accentTopGlow: Record<CardType, string> = {
  tweet:
    "linear-gradient(90deg, rgba(110,152,160,0.6), rgba(110,152,160,0.08), transparent)",
  thread:
    "linear-gradient(90deg, rgba(140,127,159,0.62), rgba(140,127,159,0.08), transparent)",
  article:
    "linear-gradient(90deg, rgba(184,148,98,0.66), rgba(184,148,98,0.08), transparent)",
  art: "linear-gradient(90deg, rgba(182,111,120,0.66), rgba(182,111,120,0.08), transparent)",
};

const cardBorder: Record<CardType, string> = {
  tweet: "rgba(110,152,160,0.18)",
  thread: "rgba(140,127,159,0.2)",
  article: "rgba(184,148,98,0.22)",
  art: "rgba(182,111,120,0.22)",
};

interface CardWrapperProps {
  type: CardType;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  href?: string;
}

export function CardWrapper({
  type,
  children,
  className,
  noPadding,
  href,
}: CardWrapperProps) {
  const outerClasses = cn(
    "group relative overflow-visible rounded-[24px] border bg-[linear-gradient(180deg,rgba(20,26,34,0.96),rgba(15,20,27,0.98))] shadow-[0_20px_48px_rgba(4,8,14,0.26)] transition-transform duration-200 ease-out hover:-translate-y-0.5",
    className
  );

  const content = (
    <>
      {type === "thread" && (
        <>
          <div className="absolute -bottom-[5px] left-[10px] right-[10px] h-[5px] rounded-b-[18px] border border-[#d6c9b210] bg-[#0d1117]" />
          <div className="absolute -bottom-[10px] left-[20px] right-[20px] h-[5px] rounded-b-[18px] border border-[#d6c9b208] bg-[#0b0f14]" />
        </>
      )}
      <div
        className={cn(
          "relative h-full overflow-hidden rounded-[23px]",
          !noPadding && "p-5"
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: accentTopGlow[type] }}
        />
        {children}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        prefetch={false}
        className={cn(outerClasses, "block no-underline text-inherit")}
        style={{ borderColor: cardBorder[type] }}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={outerClasses} style={{ borderColor: cardBorder[type] }}>
      {content}
    </div>
  );
}
