"use client";

import { motion } from "framer-motion";
import { BackNavigation } from "./back-navigation";
import { DetailContent } from "./detail-content";
import { DetailSidebar } from "./detail-sidebar";
import { ThreadChain } from "./thread-chain";
import { RelatedItems } from "./related-items";
import type { DetailItem, ContentItemWithMedia } from "@/lib/db/types";

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
  const cardType = getCardType(item.source_type);
  const isArticle = cardType === "article";
  const isThread = cardType === "thread";

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
