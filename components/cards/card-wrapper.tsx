"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type CardType = "tweet" | "thread" | "article" | "art";

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

interface CardWrapperProps {
  type: CardType;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function CardWrapper({ type, children, className, noPadding }: CardWrapperProps) {
  return (
    <div
      className={cn(
        "rounded-[14px] p-px transition-transform duration-200 ease-out cursor-pointer hover:-translate-y-0.5 relative",
        borderGradients[type],
        type === "thread" && "mb-2",
        className
      )}
    >
      {type === "thread" && (
        <>
          <div className="absolute -bottom-[5px] left-[6px] right-[6px] h-[5px] rounded-b-[14px] bg-gradient-to-r from-[#a78bfa30] via-[#a78bfa10] to-[#a78bfa30]" />
          <div className="absolute -bottom-[10px] left-[14px] right-[14px] h-[5px] rounded-b-[14px] bg-gradient-to-r from-[#a78bfa18] via-[#a78bfa06] to-[#a78bfa18]" />
        </>
      )}
      <div
        className={cn(
          "rounded-[13px] relative h-full",
          cardGradients[type],
          !noPadding && "p-5"
        )}
      >
        {children}
      </div>
    </div>
  );
}
