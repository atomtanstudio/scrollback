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
  warning?: string;
  summary?: string;
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

  const percent = data?.progress ? Math.round(data.progress * 100) : 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {state === "idle" && (
        <button
          onClick={handleStart}
          className="h-10 self-start rounded-[12px] border border-[#d6c9b214] bg-[#ffffff05] px-5 text-sm font-medium text-[#f2ede5] transition-all duration-200 cursor-pointer hover:border-[#d6c9b233]"
        >
          {buttonLabel}
        </button>
      )}

      {(state === "running" || state === "done") && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-[#8a8174]">
            <span>{data?.current || "Starting..."}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#0f141b]">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                state === "done" ? "bg-emerald-400" : "bg-[var(--accent-article)]"
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          {state === "done" && (
            <p className="text-xs text-emerald-300">
              {data?.summary || `Done: ${data?.processed ?? 0} items processed`}
            </p>
          )}
          {data?.warning && (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
              {data.warning}
            </p>
          )}
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-2">
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300/90">
            {error}
          </p>
          <button
            onClick={handleStart}
            className="h-9 self-start rounded-[12px] border border-[#d6c9b214] bg-[#ffffff05] px-4 text-sm font-medium text-[#f2ede5] transition-all duration-200 cursor-pointer hover:border-[#d6c9b233]"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
