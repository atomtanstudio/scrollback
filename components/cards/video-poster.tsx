"use client";

import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

const POSTER_CACHE_NAME = "feedsilo-video-posters";
const MAX_CONCURRENT_GENERATIONS = 2;

const posterUrlCache = new Map<string, string>();
const generationPromises = new Map<string, Promise<string | null>>();
const generationQueue: Array<() => void> = [];
let activeGenerations = 0;

function runGenerationTask<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = async () => {
      activeGenerations += 1;
      try {
        resolve(await task());
      } catch (error) {
        reject(error);
      } finally {
        activeGenerations -= 1;
        const next = generationQueue.shift();
        next?.();
      }
    };

    if (activeGenerations < MAX_CONCURRENT_GENERATIONS) {
      void run();
    } else {
      generationQueue.push(() => {
        void run();
      });
    }
  });
}

async function readPosterFromCache(cacheKey: string) {
  const cachedObjectUrl = posterUrlCache.get(cacheKey);
  if (cachedObjectUrl) {
    return cachedObjectUrl;
  }

  if (typeof window === "undefined" || !("caches" in window)) {
    return null;
  }

  const cache = await caches.open(POSTER_CACHE_NAME);
  const response = await cache.match(cacheKey);
  if (!response) {
    return null;
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  posterUrlCache.set(cacheKey, objectUrl);
  return objectUrl;
}

async function storePoster(cacheKey: string, blob: Blob) {
  if (typeof window !== "undefined" && "caches" in window) {
    const cache = await caches.open(POSTER_CACHE_NAME);
    await cache.put(
      cacheKey,
      new Response(blob, {
        headers: {
          "Content-Type": blob.type,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
    );
  }

  const objectUrl = URL.createObjectURL(blob);
  posterUrlCache.set(cacheKey, objectUrl);
  return objectUrl;
}

function waitForEvent(target: EventTarget, event: string, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`${event} timeout`));
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timer);
      target.removeEventListener(event, onSuccess);
      target.removeEventListener("error", onError);
    };

    const onSuccess = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error(`${event} failed`));
    };

    target.addEventListener(event, onSuccess, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

async function generatePoster(src: string, cacheKey: string) {
  const cachedPoster = await readPosterFromCache(cacheKey);
  if (cachedPoster) {
    return cachedPoster;
  }

  const existing = generationPromises.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = runGenerationTask(async () => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.src = src;

    try {
      await waitForEvent(video, "loadeddata", 10000);

      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return null;
      }

      if (video.duration && Number.isFinite(video.duration) && video.duration > 0.15) {
        video.currentTime = Math.min(0.15, Math.max(video.duration / 20, 0.05));
        await waitForEvent(video, "seeked", 5000);
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const context = canvas.getContext("2d");
      if (!context) {
        return null;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.72);
      });

      if (!blob) {
        return null;
      }

      return storePoster(cacheKey, blob);
    } catch {
      return null;
    } finally {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
  });

  generationPromises.set(cacheKey, promise);

  try {
    return await promise;
  } finally {
    generationPromises.delete(cacheKey);
  }
}

interface VideoPosterProps {
  src: string;
  alt: string;
  className: string;
  fallbackClassName: string;
}

export function VideoPoster({ src, alt, className, fallbackClassName }: VideoPosterProps) {
  const { ref, inView } = useInView({
    rootMargin: "280px",
    triggerOnce: true,
  });
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!inView) {
      return;
    }

    let cancelled = false;
    const cacheKey = `${src}#poster`;

    void generatePoster(src, cacheKey).then((resolvedPoster) => {
      if (!cancelled && resolvedPoster) {
        setPosterUrl(resolvedPoster);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [inView, src]);

  return (
    <div ref={ref} className={fallbackClassName}>
      {posterUrl ? (
        <img src={posterUrl} alt={alt} loading="lazy" decoding="async" className={className} />
      ) : null}
    </div>
  );
}
