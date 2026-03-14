"use client";

import { optimizeXImageUrl } from "@/lib/media-utils";
import { getMediaDisplayUrl } from "@/lib/media-url";

interface MediaItem {
  id: string;
  media_type: string;
  original_url: string;
  stored_path: string | null;
  alt_text: string | null;
  ai_description: string | null;
  width: number | null;
  height: number | null;
}

interface MediaRendererProps {
  mediaItems: MediaItem[];
  onMediaClick?: (index: number) => void;
}

function getMediaUrl(item: MediaItem): string {
  return getMediaDisplayUrl(item.stored_path, item.original_url);
}

function getOptimizedImageUrl(item: MediaItem, size: "small" | "medium" | "large" = "medium"): string {
  const url = getMediaUrl(item);
  return optimizeXImageUrl(url, size);
}

function MediaCaption({ item }: { item: MediaItem }) {
  if (!item.ai_description) return null;
  return (
    <p className="mt-1.5 px-1 text-xs italic leading-relaxed text-[#9c9387]">
      {item.ai_description}
    </p>
  );
}

export function MediaRenderer({ mediaItems, onMediaClick }: MediaRendererProps) {
  if (!mediaItems || mediaItems.length === 0) return null;

  const images = mediaItems.filter(
    (item) => item.media_type === "image" || item.media_type === "photo"
  );
  const videos = mediaItems.filter((item) => item.media_type === "video");
  const gifs = mediaItems.filter((item) => item.media_type === "gif");

  return (
    <div className="space-y-2">
      {/* Images */}
      {images.length === 1 && (
        <div>
          <img
            src={getOptimizedImageUrl(images[0], "medium")}
            alt={images[0].alt_text || ""}
            className="w-full max-h-[480px] cursor-pointer rounded-xl bg-[#10151c] object-contain"
            onClick={() => onMediaClick?.(mediaItems.indexOf(images[0]))}
          />
          <MediaCaption item={images[0]} />
        </div>
      )}

      {images.length === 2 && (
        <div className="grid grid-cols-2 gap-2">
          {images.map((item) => (
            <img
              key={item.id}
              src={getOptimizedImageUrl(item, "medium")}
              alt={item.alt_text || ""}
              className="w-full max-h-[320px] object-cover rounded-lg cursor-pointer"
              onClick={() => onMediaClick?.(mediaItems.indexOf(item))}
            />
          ))}
        </div>
      )}

      {images.length === 3 && (
        <div className="space-y-2">
          <img
            src={getOptimizedImageUrl(images[0], "medium")}
            alt={images[0].alt_text || ""}
            className="w-full max-h-[320px] object-cover rounded-lg cursor-pointer"
            onClick={() => onMediaClick?.(mediaItems.indexOf(images[0]))}
          />
          <div className="grid grid-cols-2 gap-2">
            {images.slice(1).map((item) => (
              <img
                key={item.id}
                src={getOptimizedImageUrl(item, "medium")}
                alt={item.alt_text || ""}
                className="w-full max-h-[320px] object-cover rounded-lg cursor-pointer"
                onClick={() => onMediaClick?.(mediaItems.indexOf(item))}
              />
            ))}
          </div>
        </div>
      )}

      {images.length >= 4 && (
        <div className="grid grid-cols-2 gap-2">
          {images.slice(0, 4).map((item) => (
            <img
              key={item.id}
              src={getOptimizedImageUrl(item, "medium")}
              alt={item.alt_text || ""}
              className="w-full max-h-[320px] object-cover rounded-lg cursor-pointer"
              onClick={() => onMediaClick?.(mediaItems.indexOf(item))}
            />
          ))}
        </div>
      )}

      {/* Videos */}
      {videos.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onMediaClick?.(mediaItems.indexOf(item))}
          className="group relative block w-full overflow-hidden rounded-xl bg-[#10151c] text-left"
          aria-label="Open video in gallery"
        >
          <video
            preload="metadata"
            muted
            playsInline
            className="w-full max-h-[480px] cursor-pointer rounded-xl bg-[#10151c]"
          >
            <source src={getMediaUrl(item)} />
          </video>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(7,7,12,0.8)] via-transparent to-transparent opacity-90" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-4 py-3 text-white">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/78">
              Video
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[rgba(20,20,28,0.72)] transition-transform duration-200 group-hover:scale-105">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18a1 1 0 0 0 0-1.68L9.54 5.98A1 1 0 0 0 8 6.82Z" />
              </svg>
            </span>
          </div>
        </button>
      ))}

      {/* GIFs */}
      {gifs.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onMediaClick?.(mediaItems.indexOf(item))}
          className="group relative block w-full overflow-hidden rounded-xl bg-[#10151c] text-left"
          aria-label="Open GIF in gallery"
        >
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full max-h-[480px] cursor-pointer rounded-xl bg-[#10151c]"
          >
            <source src={getMediaUrl(item)} />
          </video>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-4 py-3 text-white">
            <span className="rounded-full border border-white/16 bg-[rgba(20,20,28,0.72)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/78">
              GIF
            </span>
            <span className="rounded-full border border-white/16 bg-[rgba(20,20,28,0.72)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/78">
              View
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
