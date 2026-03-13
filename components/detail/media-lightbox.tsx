"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { optimizeXImageUrl } from "@/lib/media-utils";

interface MediaLightboxItem {
  id: string;
  media_type: string;
  original_url: string;
  stored_path: string | null;
  alt_text: string | null;
}

interface MediaLightboxProps {
  mediaItems: MediaLightboxItem[];
  initialIndex: number;
  onClose: () => void;
}

function getMediaUrl(item: MediaLightboxItem): string {
  return item.stored_path || item.original_url;
}

function getLargeImageUrl(item: MediaLightboxItem): string {
  return optimizeXImageUrl(getMediaUrl(item), "large");
}

export function MediaLightbox({
  mediaItems,
  initialIndex,
  onClose,
}: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const images = mediaItems.filter(
    (item) => item.media_type === "image" || item.media_type === "photo"
  );

  const total = images.length;
  const currentImage = images[currentIndex] ?? images[0];

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && total > 1) {
        setCurrentIndex((prev) => (prev - 1 + total) % total);
      } else if (e.key === "ArrowRight" && total > 1) {
        setCurrentIndex((prev) => (prev + 1) % total);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, total]);

  if (!currentImage) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Close lightbox"
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Previous arrow */}
        {total > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-4 z-10 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label="Previous image"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        {/* Next arrow */}
        {total > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-4 z-10 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            aria-label="Next image"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Image container */}
        <motion.div
          key={currentIndex}
          className="relative z-10 flex items-center justify-center"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={getLargeImageUrl(currentImage)}
            alt={currentImage.alt_text || ""}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
          />
        </motion.div>

        {/* Index indicator */}
        {total > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(i);
                }}
                className="w-2 h-2 rounded-full transition-colors"
                style={{
                  backgroundColor:
                    i === currentIndex
                      ? "rgba(255,255,255,0.9)"
                      : "rgba(255,255,255,0.3)",
                }}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
