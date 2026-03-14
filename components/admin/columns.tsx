export interface AdminItem {
  id: string;
  external_id: string;
  source_type: string;
  title: string | null;
  body_text: string | null;
  body_preview: string;
  author_handle: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  original_url: string | null;
  posted_at: string | null;
  created_at: string;
  thumbnail: string | null;
}
