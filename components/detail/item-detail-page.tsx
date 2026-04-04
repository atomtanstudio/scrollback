"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { BackNavigation } from "./back-navigation";
import { DetailContent } from "./detail-content";
import { DetailSidebar } from "./detail-sidebar";
import { ThreadChain } from "./thread-chain";
import { RelatedItems } from "./related-items";
import type { DetailItem, ContentItemWithMedia } from "@/lib/db/types";
import { hasEnglishTranslation } from "@/lib/content-display";
import { originalLooksLikeForeignText } from "@/lib/translation-backfill";

type CardType = "tweet" | "thread" | "article" | "art";

function getCardType(sourceType: string): CardType {
  switch (sourceType) {
    case "tweet":
      return "tweet";
    case "thread":
      return "thread";
    case "article":
      return "article";
    case "image_prompt":
    case "video_prompt":
      return "art";
    default:
      return "tweet";
  }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

interface ItemDetailPageProps {
  item: DetailItem;
  threadSiblings?: ContentItemWithMedia[];
  isAuthed?: boolean;
}

export function ItemDetailPage({ item, threadSiblings = [], isAuthed = false }: ItemDetailPageProps) {
  const router = useRouter();
  const cardType = getCardType(item.source_type);
  const isArticle = cardType === "article";
  const isThread = cardType === "thread";
  const [pollCount, setPollCount] = useState(0);

  const shouldPollForTranslation = useMemo(() => {
    if (item.processing_status === "error") return false;
    if (item.processing_status !== "indexed") return true;
    return originalLooksLikeForeignText(item.title, item.body_text) && !hasEnglishTranslation(item);
  }, [item]);

  useEffect(() => {
    if (!shouldPollForTranslation) return;
    if (pollCount >= 18) return; // about 90 seconds at 5s intervals

    const timer = window.setTimeout(() => {
      setPollCount((count) => count + 1);
      router.refresh();
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [pollCount, router, shouldPollForTranslation]);

  return (
    <div className="relative z-[1] mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <motion.div
        variants={containerVariants}
        initial={false}
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <BackNavigation />
        </motion.div>

        {shouldPollForTranslation && (
          <motion.div variants={itemVariants} className="mb-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[rgba(184,148,98,0.24)] bg-[linear-gradient(180deg,rgba(184,148,98,0.10),rgba(255,255,255,0.03))] px-4 py-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#f0cf9f]">
                  Processing Capture
                </p>
                <p className="mt-1 text-[13px] text-[#cdbda6]">
                  Translating and indexing this item in the background. This page refreshes automatically while it finishes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.refresh()}
                className="rounded-full border border-[#d6c9b214] bg-[#0f141b] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f2ede5] transition-colors hover:border-[#d6c9b233] hover:text-white"
              >
                Refresh now
              </button>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <motion.div variants={itemVariants}>
            <div className="overflow-hidden rounded-[30px] border border-[#d6c9b214] bg-[linear-gradient(180deg,rgba(24,29,37,0.96),rgba(14,18,24,0.98))] shadow-[0_34px_90px_rgba(2,6,12,0.32)]">
              <div className={isArticle ? "p-8 sm:p-10" : "p-6 sm:p-8"}>
                {isThread && threadSiblings.length > 0 ? (
                  <ThreadChain currentItem={item} siblings={threadSiblings} />
                ) : (
                  <DetailContent item={item} cardType={cardType} />
                )}
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <DetailSidebar item={item} cardType={cardType} isAuthed={isAuthed} />
          </motion.div>
        </div>

        <motion.div variants={itemVariants} className="mt-10">
          <RelatedItems itemId={item.id} />
        </motion.div>
      </motion.div>
    </div>
  );
}
