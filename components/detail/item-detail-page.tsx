"use client";

import { motion } from "framer-motion";
import { BackNavigation } from "./back-navigation";
import { DetailContent } from "./detail-content";
import { DetailSidebar } from "./detail-sidebar";
import type { DetailItem } from "@/lib/db/types";

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
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
};

interface ItemDetailPageProps {
  item: DetailItem;
}

export function ItemDetailPage({ item }: ItemDetailPageProps) {
  const cardType = getCardType(item.source_type);
  const isArticle = cardType === "article";

  return (
    <div className="max-w-[960px] mx-auto px-5 py-6 relative z-[1]">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Back navigation */}
        <motion.div variants={itemVariants}>
          <BackNavigation />
        </motion.div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-start">
          {/* Left column: content card */}
          <motion.div variants={itemVariants}>
            <div
              className={`rounded-[16px] p-px border-gradient-${cardType}`}
            >
              <div
                className={`rounded-[15px] overflow-hidden card-gradient-${cardType}${isArticle ? "" : " p-8"}`}
              >
                {isArticle ? (
                  <div className="p-8">
                    <DetailContent item={item} cardType={cardType} />
                  </div>
                ) : (
                  <DetailContent item={item} cardType={cardType} />
                )}
              </div>
            </div>
          </motion.div>

          {/* Right column: sidebar */}
          <motion.div variants={itemVariants}>
            <DetailSidebar item={item} cardType={cardType} />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
