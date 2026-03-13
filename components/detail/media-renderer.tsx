"use client";

import { optimizeXImageUrl } from "@/lib/media-utils";
import { getMediaDisplayUrl } from "@/lib/media-url";

interface MediaItem {
  id: string;
  media_type: string;
  original_url: string;
  stored_path: string | null;
  alt_text: string | null;
  width: number | null;
  height: number | null;
}

interface MediaRendererProps {
  mediaItems: MediaItem[];
  onImageClick?: (index: number) => void;
}

function getMediaUrl(item: MediaItem): string {
  return getMediaDisplayUrl(item.stored_path, item.original_url);
}

function getOptimizedImageUrl(item: MediaItem, size: "small" | "medium" | "large" = "medium"): string {
  const url = getMediaUrl(item);
  return optimizeXImageUrl(url, size);
}

export function MediaRenderer({ mediaItems, onImageClick }: MediaRendererProps) {
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
        <img
          src={getOptimizedImageUrl(images[0], "medium")}
          alt={images[0].alt_text || ""}
          className="w-full max-h-[480px] object-contain rounded-xl bg-[#0c0c14] cursor-pointer"
          onClick={() => onImageClick?.(mediaItems.indexOf(images[0]))}
        />
      )}

      {images.length === 2 && (
        <div className="grid grid-cols-2 gap-2">
          {images.map((item) => (
            <img
              key={item.id}
              src={getOptimizedImageUrl(item, "medium")}
              alt={item.alt_text || ""}
              className="w-full max-h-[320px] object-cover rounded-lg cursor-pointer"
              onClick={() => onImageClick?.(mediaItems.indexOf(item))}
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
            onClick={() => onImageClick?.(mediaItems.indexOf(images[0]))}
          />
          <div className="grid grid-cols-2 gap-2">
            {images.slice(1).map((item) => (
              <img
                key={item.id}
                src={getOptimizedImageUrl(item, "medium")}
                alt={item.alt_text || ""}
                className="w-full max-h-[320px] object-cover rounded-lg cursor-pointer"
                onClick={() => onImageClick?.(mediaItems.indexOf(item))}
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
              onClick={() => onImageClick?.(mediaItems.indexOf(item))}
            />
          ))}
        </div>
      )}

      {/* Videos */}
      {videos.map((item) => (
        <video
          key={item.id}
          controls
          preload="metadata"
          className="w-full max-h-[480px] rounded-xl bg-[#0c0c14]"
        >
          <source src={getMediaUrl(item)} />
        </video>
      ))}

      {/* GIFs */}
      {gifs.map((item) => (
        <video
          key={item.id}
          autoPlay
          muted
          loop
          playsInline
          className="w-full max-h-[480px] rounded-xl bg-[#0c0c14]"
        >
          <source src={getMediaUrl(item)} />
        </video>
      ))}
    </div>
  );
}
