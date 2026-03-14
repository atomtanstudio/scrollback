"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  endpoint: string;
  buttonLabel: string;
  className?: string;
}

type ProgressState = "idle" | "running" | "done" | "error";

interface ProgressData {
  progress: number;
  processed: number;
  total: number;
  current?: string;
  done?: boolean;
  error?: string;
}

export function ProgressBar({ endpoint, buttonLabel, className }: ProgressBarProps) {
  const [state, setState] = useState<ProgressState>("idle");
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Clean up EventSource on unmount or when a new one starts
  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []);

  const handleStart = useCallback(() => {
    // Close any existing connection first
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    setState("running");
    setError(null);
    setData({ progress: 0, processed: 0, total: 0 });

    const es = new EventSource(endpoint);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const parsed: ProgressData = JSON.parse(event.data);
        setData(parsed);

        if (parsed.error) {
          setState("error");
          setError(parsed.error);
          es.close();
          esRef.current = null;
          return;
        }

        if (parsed.done) {
          setState("done");
          es.close();
          esRef.current = null;
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setState("error");
      setError("Connection lost");
      es.close();
      esRef.current = null;
    };
  }, [endpoint]);

  const percent = data ? Math.round(data.progress * 100) : 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {state === "idle" && (
        <button
          onClick={handleStart}
          className="h-10 px-5 rounded-[10px] text-sm font-medium bg-[#1a1a24] text-[#f0f0f5] border border-[#ffffff12] hover:border-[#ffffff24] transition-all duration-200 cursor-pointer self-start"
        >
          {buttonLabel}
        </button>
      )}

      {(state === "running" || state === "done") && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
            <span>{data?.current || "Starting..."}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 bg-[#1a1a24] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                state === "done" ? "bg-emerald-500" : "bg-[var(--accent-thread)]"
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          {state === "done" && (
            <p className="text-xs text-emerald-400">
              Done — {data?.processed} items processed
            </p>
          )}
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
          <button
            onClick={handleStart}
            className="h-9 px-4 rounded-[10px] text-sm font-medium bg-[#1a1a24] text-[#f0f0f5] border border-[#ffffff12] hover:border-[#ffffff24] transition-all duration-200 cursor-pointer self-start"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
