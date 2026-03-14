"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Settings, LogOut, Shield } from "lucide-react";

interface HeaderProps {
  captureCount?: number;
}

export function Header({ captureCount }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="flex items-center justify-between py-6">
      <Link
        href="/"
        className="font-heading font-semibold text-[21px] tracking-tight text-[#f0f0f5] flex items-center hover:opacity-80 transition-opacity"
      >
        feed
        <span className="inline-block w-[5px] h-[5px] rounded-full bg-[var(--accent-thread)] mx-[1px] relative top-[1px]" />
        silo
      </Link>

      <div className="flex items-center gap-4">
        {captureCount !== undefined && (
          <span className="text-[13px] text-[#555566]">
            {captureCount.toLocaleString()} captures
          </span>
        )}
        {session ? (
          <>
            <Link
              href="/admin"
              className="text-[#555566] hover:text-[#f0f0f5] transition-colors"
              aria-label="Admin"
            >
              <Shield size={18} />
            </Link>
            <button
              onClick={() => signOut()}
              className="text-[#555566] hover:text-[#f0f0f5] transition-colors"
              aria-label="Logout"
            >
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="text-[13px] text-[#555566] hover:text-[#f0f0f5] transition-colors"
          >
            Login
          </Link>
        )}
        <Link
          href="/settings"
          className="text-[#555566] hover:text-[#f0f0f5] transition-colors"
          aria-label="Settings"
        >
          <Settings size={18} />
        </Link>
      </div>
    </header>
  );
}
