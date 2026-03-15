"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { optimizeXImageUrl } from "@/lib/media-utils";
import { getMediaDisplayUrl } from "@/lib/media-url";
import { getPromptPreview } from "@/lib/prompt-preview";

interface MediaLightboxItem {
  id: string;
  media_type: string;
  original_url: string;
  stored_path: string | null;
  alt_text: string | null;
  ai_description?: string | null;
}

interface MediaLightboxProps {
  mediaItems: MediaLightboxItem[];
  initialIndex: number;
  onClose: () => void;
}

function getMediaUrl(item: MediaLightboxItem): string {
  return getMediaDisplayUrl(item.stored_path, item.original_url);
}

function getLargeImageUrl(item: MediaLightboxItem): string {
  return optimizeXImageUrl(getMediaUrl(item), "large");
}

function getThumbnailImageUrl(item: MediaLightboxItem): string {
  return optimizeXImageUrl(getMediaUrl(item), "small");
}

export function MediaLightbox({
  mediaItems,
  initialIndex,
  onClose,
}: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [copied, setCopied] = useState(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const total = mediaItems.length;
  const currentItem = mediaItems[currentIndex] ?? mediaItems[0];
  const isVideo = currentItem?.media_type === "video";
  const isGif = currentItem?.media_type === "gif";
  const promptPreview = getPromptPreview(
    currentItem?.alt_text,
    currentItem?.media_type || "image"
  );
  const captionText = currentItem?.alt_text || currentItem?.ai_description || "";
  const plainCaptionPreview =
    captionText.length > 220 ? `${captionText.slice(0, 217).trimEnd()}...` : captionText;

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    setCopied(false);
  }, [currentIndex]);

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

  if (!currentItem) return null;

  const handleCopyPrompt = async () => {
    if (!promptPreview) return;

    try {
      await navigator.clipboard.writeText(promptPreview.fullText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || total <= 1 || !swipeStartRef.current) {
      return;
    }

    const deltaX = event.clientX - swipeStartRef.current.x;
    const deltaY = event.clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;

    if (Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) {
      return;
    }

    if (deltaX > 0) goPrev();
    else goNext();
  };

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
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Close lightbox"
        />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
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

        {total > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Previous media item"
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

        {total > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Next media item"
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

        <motion.div
          key={currentIndex}
          className="relative z-10 flex items-center justify-center"
          initial={isVideo || isGif ? { opacity: 0, y: 12 } : { scale: 0.9, opacity: 0 }}
          animate={isVideo || isGif ? { opacity: 1, y: 0 } : { scale: 1, opacity: 1 }}
          exit={isVideo || isGif ? { opacity: 0, y: 12 } : { scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          style={{ touchAction: total > 1 ? "pan-y" : "auto" }}
        >
          <div className="flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-4">
            <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(10,10,16,0.96)] shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
              {isVideo || isGif ? (
                <video
                  src={getMediaUrl(currentItem)}
                  controls
                  autoPlay={isGif}
                  muted={isGif}
                  loop={isGif}
                  playsInline
                  className="max-h-[78vh] max-w-[90vw] object-contain"
                />
              ) : (
                <img
                  src={getLargeImageUrl(currentItem)}
                  alt={currentItem.alt_text || ""}
                  className="max-h-[78vh] max-w-[90vw] object-contain"
                />
              )}
            </div>

            <div className="w-full max-w-[760px] rounded-[28px] border border-white/10 bg-[rgba(12,12,18,0.82)] px-4 py-3 text-white/88 backdrop-blur-md">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
                    {isVideo ? "Video" : isGif ? "GIF" : "Image"} · {currentIndex + 1} / {total}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {promptPreview && (
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="shrink-0 rounded-full border border-[rgba(120,198,255,0.22)] bg-[rgba(55,104,146,0.18)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c9ecff] transition-colors hover:bg-[rgba(55,104,146,0.28)]"
                    >
                      {copied ? "Copied" : "Copy Prompt"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/72 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>

              {captionText && (
                <div className="mt-2 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
                    {promptPreview ? promptPreview.label : "Caption"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white/86">
                    {promptPreview ? promptPreview.preview : plainCaptionPreview}
                  </p>
                </div>
              )}
            </div>

            {total > 1 && (
              <div className="w-full max-w-[760px] overflow-x-auto pb-1">
                <div className="flex min-w-max gap-2">
                  {mediaItems.map((item, i) => {
                    const itemIsVideo = item.media_type === "video";
                    const itemIsGif = item.media_type === "gif";

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCurrentIndex(i)}
                        className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border transition-all"
                        style={{
                          borderColor:
                            i === currentIndex
                              ? "rgba(255,255,255,0.6)"
                              : "rgba(255,255,255,0.1)",
                          boxShadow:
                            i === currentIndex
                              ? "0 0 0 1px rgba(255,255,255,0.15)"
                              : "none",
                        }}
                        aria-label={`Go to media item ${i + 1}`}
                      >
                        {itemIsVideo || itemIsGif ? (
                          <video
                            src={getMediaUrl(item)}
                            muted
                            playsInline
                            autoPlay={itemIsGif}
                            loop={itemIsGif}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <img
                            src={getThumbnailImageUrl(item)}
                            alt={item.alt_text || ""}
                            className="h-full w-full object-cover"
                          />
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                        {(itemIsVideo || itemIsGif) && (
                          <span className="pointer-events-none absolute bottom-1 right-1 rounded-full border border-white/14 bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/80">
                            {itemIsGif ? "GIF" : "VID"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
