"use client";

import { TweetCard } from "./tweet-card";
import { ThreadCard } from "./thread-card";
import { ArticleCard } from "./article-card";
import { ArtCard } from "./art-card";
import type { ContentItem } from "@/lib/db/types";

interface ContentCardProps {
  item: ContentItem & { media_items?: any[] };
}

export function ContentCard({ item }: ContentCardProps) {
  switch (item.source_type) {
    case "tweet":
      return <TweetCard item={item} />;
    case "thread":
      return <ThreadCard item={item} />;
    case "article":
      return <ArticleCard item={item} />;
    case "image_prompt":
    case "video_prompt":
      return <ArtCard item={item} />;
    default:
      return <TweetCard item={item} />;
  }
}
