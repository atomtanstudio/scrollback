"use client";

import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/lib/auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="mt-2 inline-flex h-12 items-center justify-center rounded-[16px] border border-[#cfb28a55] bg-[#b89462] px-8 font-heading text-[15px] font-semibold text-[#10141a] shadow-[0_16px_40px_rgba(184,148,98,0.24)] transition-all duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8c0a0] disabled:cursor-default disabled:opacity-30 disabled:hover:brightness-100"
      disabled={pending}
    >
      {pending ? "Signing in..." : "Sign In"}
    </button>
  );
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const errorParam = searchParams.get("error");
  const error = errorParam ? "Invalid email or password" : "";

  return (
    <div className="w-full rounded-[28px] border border-[#d6c9b214] bg-[#ffffff08] p-6 sm:p-7">
      <div className="mb-6 text-center">
        <Link
          href="/"
          className="font-heading text-2xl font-semibold tracking-[-0.05em] text-[#f2ede5] transition-opacity hover:opacity-80"
        >
          feed
          <span className="text-[var(--accent-article)]">.</span>
          silo
        </Link>
      </div>

      <h1 className="text-center font-heading text-[2rem] font-semibold tracking-[-0.05em] text-[#f2ede5]">
        Sign in
      </h1>
      <p className="mt-2 text-center text-sm leading-7 text-[#b4ab9d]">
        Unlock settings and admin surfaces for this local instance.
      </p>

      <form action={loginAction} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <div>
          <label className="mb-2 block text-[13px] font-medium text-[#e7e0d5]">
            Email
          </label>
          <input
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            className="h-11 w-full rounded-[16px] border border-[#d6c9b21f] bg-[#0f141b] px-4 text-sm text-[#f2ede5] placeholder:text-[#7d7569] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
          />
        </div>

        <div>
          <label className="mb-2 block text-[13px] font-medium text-[#e7e0d5]">
            Password
          </label>
          <input
            name="password"
            type="password"
            placeholder="Enter your password"
            required
            className="h-11 w-full rounded-[16px] border border-[#d6c9b21f] bg-[#0f141b] px-4 text-sm text-[#f2ede5] placeholder:text-[#7d7569] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
          />
        </div>

        {error && (
          <p className="rounded-[14px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
            {error}
          </p>
        )}

        <SubmitButton />
      </form>
    </div>
  );
}
