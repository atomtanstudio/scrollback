import Link from "next/link";
import { BrandWordmark } from "@/components/brand-wordmark";

export default function ArchivePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="font-heading text-[clamp(1.7rem,2vw,2.15rem)] font-semibold tracking-[-0.05em] text-[#f2ede5] transition-opacity hover:opacity-80"
          >
            <BrandWordmark className="text-[1em]" />
          </Link>
          <div className="flex gap-2">
            <Link
              href="/"
              className="rounded-full border border-[#d6c9b21a] bg-[#ffffff08] px-4 py-2 text-sm text-[#a49b8b] transition-colors hover:text-[#f2ede5]"
            >
              Library
            </Link>
            <Link
              href="/settings"
              className="rounded-full border border-[#d6c9b21a] bg-[#ffffff08] px-4 py-2 text-sm text-[#a49b8b] transition-colors hover:text-[#f2ede5]"
            >
              Settings
            </Link>
          </div>
        </div>

        <section className="overflow-hidden rounded-[28px] border border-[#d6c9b21a] bg-[linear-gradient(180deg,rgba(24,29,37,0.96),rgba(14,18,24,0.98))] shadow-[0_34px_90px_rgba(2,6,12,0.45)]">
          <div className="grid gap-0 lg:grid-cols-[0.95fr_1.1fr]">
            <div className="border-b border-[#d6c9b214] p-7 sm:p-10 lg:border-b-0 lg:border-r">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#a49b8b]">
                Archive
              </p>
              <h1 className="mt-4 max-w-[11ch] font-heading text-[clamp(2.6rem,5vw,4.4rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-[#f2ede5]">
                Long-view tools are next.
              </h1>
              <p className="mt-5 max-w-[44ch] text-[16px] leading-8 text-[#b4ab9d]">
                The archive surface will become the quiet back room of your
                library: bulk review, older captures, resurfacing rules, and
                slower research workflows.
              </p>
            </div>

            <div className="grid gap-4 p-7 sm:grid-cols-2 sm:p-10">
              <div className="rounded-[26px] border border-[#d6c9b214] bg-[#ffffff08] p-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">
                  Planned
                </p>
                <h2 className="mt-3 font-heading text-2xl font-semibold tracking-[-0.04em] text-[#f2ede5]">
                  Resurfacing
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#b4ab9d]">
                  Bring older captures back into focus without turning the main
                  feed into a storage closet.
                </p>
              </div>

              <div className="rounded-[26px] border border-[#d6c9b214] bg-[#ffffff08] p-5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">
                  Planned
                </p>
                <h2 className="mt-3 font-heading text-2xl font-semibold tracking-[-0.04em] text-[#f2ede5]">
                  Batch review
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#b4ab9d]">
                  Clean up stale captures, re-run classification, and process
                  older items in deliberate groups.
                </p>
              </div>

              <div className="rounded-[26px] border border-[#d6c9b214] bg-[#ffffff08] p-5 sm:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">
                  Until then
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link
                    href="/"
                    className="inline-flex items-center rounded-full border border-[#cfb28a55] bg-[#b89462] px-5 py-3 text-sm font-semibold text-[#10141a] transition hover:brightness-105"
                  >
                    Browse recent captures
                  </Link>
                  <Link
                    href="/settings"
                    className="inline-flex items-center rounded-full border border-[#d6c9b21a] bg-[#ffffff05] px-5 py-3 text-sm font-medium text-[#cdc4b7] transition hover:border-[#d6c9b233] hover:text-[#f2ede5]"
                  >
                    Manage sources
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
