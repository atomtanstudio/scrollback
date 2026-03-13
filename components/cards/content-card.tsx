"use client";

import { TweetCard } from "./tweet-card";
import { ThreadCard } from "./thread-card";
import { ArticleCard } from "./article-card";
import { ArtCard } from "./art-card";
import type { ContentItemWithMedia } from "@/lib/db/types";

interface ContentCardProps {
  item: ContentItemWithMedia;
}

export function ContentCard({ item }: ContentCardProps) {
  const href = `/item/${item.id}`;
  switch (item.source_type) {
    case "tweet":
      return <TweetCard item={item} href={href} />;
    case "thread":
      return <ThreadCard item={item} href={href} />;
    case "article":
      return <ArticleCard item={item} href={href} />;
    case "image_prompt":
    case "video_prompt":
      return <ArtCard item={item} href={href} />;
    default:
      return <TweetCard item={item} href={href} />;
  }
}
