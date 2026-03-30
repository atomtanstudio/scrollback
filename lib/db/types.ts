export type { ContentItemModel as ContentItem } from "@/lib/generated/prisma/models/ContentItem";
export type { MediaModel as Media } from "@/lib/generated/prisma/models/Media";

import type { ContentItemModel } from "@/lib/generated/prisma/models/ContentItem";
import type { MediaModel } from "@/lib/generated/prisma/models/Media";
import type { CategoryModel } from "@/lib/generated/prisma/models/Category";
import type { TagModel } from "@/lib/generated/prisma/models/Tag";

export type ContentItemWithMedia = ContentItemModel & {
  media_items?: MediaModel[];
};

export type DetailItem = ContentItemModel & {
  media_items: MediaModel[];
  categories: Array<{ category: CategoryModel }>;
  tags: Array<{ tag: TagModel }>;
};

export interface SearchFilters {
  type?: string; // source_type filter
  author?: string; // author_handle or author_display_name
  dateFrom?: string; // ISO date
  dateTo?: string; // ISO date
  userId?: string; // scope to a specific user
}

export interface SearchOptions {
  page: number;
  perPage: number;
}

export interface ScoredResult {
  id: string;
  source_type: string;
  title: string;
  body_excerpt: string;
  author_handle: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  source_url: string | null;
  posted_at: string | null; // ISO datetime
  media_preview: MediaPreview | null;
  relevance_score: number;
}

export interface MediaPreview {
  id: string;
  type: string;
  url: string;
}

export interface SearchResponse {
  results: ScoredResult[];
  total: number;
  page: number;
  per_page: number;
}

export interface CapturePayload {
  external_id: string;
  source_url: string;
  source_type?: string;
  source_platform?: string;
  source_label?: string | null;
  source_domain?: string | null;
  rss_feed_id?: string | null;
  author_handle?: string | null;
  author_display_name?: string | null;
  author_avatar_url?: string | null;
  title?: string | null;
  body_text: string;
  body_html?: string | null;
  posted_at?: string | null;
  media_urls?: string[];
  conversation_id?: string | null;
  likes?: number | null;
  retweets?: number | null;
  replies?: number | null;
  views?: number | null;
}

export interface CaptureResult {
  success: boolean;
  already_exists: boolean;
  item_id?: string;
  error?: string;
}

export interface BulkCaptureResult {
  success: boolean;
  captured: number;
  skipped: number;
  errors: number;
  results: CaptureResult[];
}
