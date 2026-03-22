"use client";

import Link from "next/link";
import { Settings, LogOut, Shield } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { BrandWordmark } from "@/components/brand-wordmark";

interface HeaderProps {
  captureCount?: number;
  isAuthed: boolean;
  currentPath?: string;
}

export function Header({ captureCount, isAuthed, currentPath = "/" }: HeaderProps) {
  const loginHref =
    currentPath === "/"
      ? "/login"
      : `/login?callbackUrl=${encodeURIComponent(currentPath)}`;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-6 sm:gap-4">
      <Link
        href="/"
        className="font-heading flex items-center text-[clamp(1.7rem,2vw,2.15rem)] font-semibold tracking-[-0.05em] text-[#f2ede5] transition-opacity hover:opacity-80"
      >
        <BrandWordmark className="text-[1em]" />
      </Link>

      <div className="flex flex-wrap items-center justify-end gap-2 text-[13px] text-[#a49b8b]">
        {captureCount !== undefined && (
          <span className="rounded-full border border-[#d6c9b21a] bg-[#ffffff08] px-3 py-2 sm:px-4">
            <span className="sm:hidden">{captureCount.toLocaleString()}</span>
            <span className="hidden sm:inline">
              {captureCount.toLocaleString()} saves
            </span>
          </span>
        )}
        {isAuthed && (
          <>
            {/* Hard links for auth-sensitive pages — avoids Next.js router
                cache serving stale auth state after login/logout */}
            <a
              href="/admin"
              className="rounded-full border border-[#d6c9b21a] bg-[#ffffff08] px-3 py-2 text-[#a49b8b] transition-colors hover:text-[#f2ede5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
              aria-label="Admin"
            >
              <Shield size={18} />
            </a>
            <form action={logoutAction}>
              <button
                type="submit"
                className="cursor-pointer rounded-full border border-[#d6c9b21a] bg-[#ffffff08] px-3 py-2 text-[#a49b8b] transition-colors hover:text-[#f2ede5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
                aria-label="Logout"
              >
                <LogOut size={18} />
              </button>
            </form>
          </>
        )}
        {!isAuthed && (
          <a
            href={loginHref}
            className="rounded-full border border-[#d6c9b21a] bg-[#ffffff08] px-4 py-2 text-[#a49b8b] transition-colors hover:text-[#f2ede5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
          >
            Login
          </a>
        )}
        <a
          href="/settings"
          className="rounded-full border border-[#d6c9b21a] bg-[#ffffff08] px-3 py-2 text-[#a49b8b] transition-colors hover:text-[#f2ede5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
          aria-label="Settings"
        >
          <Settings size={18} />
        </a>
      </div>
    </header>
  );
}
