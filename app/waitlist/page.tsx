"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandWordmark } from "@/components/brand-wordmark";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "already" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      const data = await res.json();
      setStatus(data.alreadyRegistered ? "already" : "success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[540px]">
        <div className="mb-10 text-center">
          <Link
            href="/"
            className="font-heading text-[clamp(1.7rem,2vw,2.15rem)] font-semibold tracking-[-0.05em] text-[#f2ede5] transition-opacity hover:opacity-80"
          >
            <BrandWordmark className="text-[1em]" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-[#d6c9b21a] bg-[linear-gradient(180deg,rgba(24,29,37,0.96),rgba(14,18,24,0.98))] p-8 shadow-[0_34px_90px_rgba(2,6,12,0.45)] sm:p-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#a49b8b]">
            Coming soon
          </p>
          <h1 className="mt-4 font-heading text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1] tracking-[-0.05em] text-[#f2ede5]">
            FeedSilo Cloud
          </h1>
          <p className="mt-4 max-w-[38ch] text-[16px] leading-8 text-[#b4ab9d]">
            Your own hosted FeedSilo instance. No server setup, automatic updates, managed backups. We&apos;ll let you know when it&apos;s ready.
          </p>

          {status === "success" || status === "already" ? (
            <div className="mt-8 rounded-[16px] border border-[#4ade8033] bg-[#4ade801a] px-5 py-4 text-center">
              <p className="text-sm font-medium text-[#86efac]">
                {status === "already" ? "You're already on the list!" : "You're on the list!"}
              </p>
              <p className="mt-1 text-sm text-[#6ee7a0aa]">
                We&apos;ll email you when FeedSilo Cloud is ready.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 flex-1 rounded-[14px] border border-[#d6c9b21f] bg-[#0f141b] px-4 text-sm text-[#f2ede5] placeholder:text-[#7d7569] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="h-11 shrink-0 rounded-[14px] border border-[#cfb28a55] bg-[#b89462] px-6 font-heading text-[14px] font-semibold text-[#10141a] shadow-[0_12px_32px_rgba(184,148,98,0.2)] transition-all hover:brightness-105 disabled:opacity-50"
              >
                {status === "loading" ? "Joining..." : "Join the Waitlist"}
              </button>
            </form>
          )}

          {status === "error" && (
            <p className="mt-3 text-center text-sm text-red-400">
              Something went wrong. Please try again.
            </p>
          )}

          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#d6c9b214]" />
            <span className="text-[11px] uppercase tracking-[0.14em] text-[#7d7569]">or</span>
            <div className="h-px flex-1 bg-[#d6c9b214]" />
          </div>

          <p className="mt-6 text-center text-sm text-[#b4ab9d]">
            Self-host FeedSilo today.{" "}
            <a
              href="https://github.com/atomtanstudio/feedsilo"
              className="font-medium text-[#d8c0a0] underline underline-offset-2 hover:text-[#f2ede5]"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
