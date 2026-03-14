import { Suspense } from "react";
import { LoginForm } from "@/components/login/login-form";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Login — FeedSilo" };

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#090c11] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="font-heading text-[clamp(1.7rem,2vw,2.15rem)] font-semibold tracking-[-0.05em] text-[#f2ede5] transition-opacity hover:opacity-80"
          >
            feed
            <span className="relative top-[1px] mx-[1px] inline-block h-[5px] w-[5px] rounded-full bg-[var(--accent-article)]" />
            silo
          </Link>
          <Link
            href="/"
            className="rounded-full border border-[#d6c9b21a] bg-[#ffffff08] px-4 py-2 text-sm text-[#a49b8b] transition-colors hover:text-[#f2ede5]"
          >
            Back to library
          </Link>
        </div>

        <section className="overflow-hidden rounded-[34px] border border-[#d6c9b21a] bg-[linear-gradient(180deg,rgba(24,29,37,0.96),rgba(14,18,24,0.98))] shadow-[0_34px_90px_rgba(2,6,12,0.45)]">
          <div className="grid lg:grid-cols-[1.15fr_420px]">
            <div className="border-b border-[#d6c9b214] p-7 sm:p-10 lg:border-b-0 lg:border-r">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#a49b8b]">
                Protected surfaces
              </p>
              <h1 className="mt-4 max-w-[10ch] font-heading text-[clamp(2.7rem,5vw,4.6rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-[#f2ede5]">
                Enter the control room.
              </h1>
              <p className="mt-5 max-w-[42ch] text-[16px] leading-8 text-[#b4ab9d]">
                Admin, settings, and maintenance tools live behind a local
                account so the rest of the archive can stay quiet and public.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff08] p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#a49b8b]">
                    Admin
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#cdc4b7]">
                    Review captures, reprocess items, and handle cleanup work.
                  </p>
                </div>
                <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff08] p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#a49b8b]">
                    Settings
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#cdc4b7]">
                    Configure your data sources, APIs, embeddings, and storage.
                  </p>
                </div>
                <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff08] p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#a49b8b]">
                    Local-first
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#cdc4b7]">
                    Credentials stay on your machine and protect only the
                    surfaces that need guardrails.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <Suspense>
                <LoginForm />
              </Suspense>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
