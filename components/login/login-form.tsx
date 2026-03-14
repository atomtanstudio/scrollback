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
      className="h-12 px-8 rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold text-[15px] hover:brightness-110 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-default mt-2"
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
    <div className="w-full max-w-[400px] bg-[var(--surface)] border border-[hsl(var(--border))] rounded-[14px] p-8">
      {/* Logo — links back to home */}
      <div className="text-center mb-6">
        <Link href="/" className="font-heading font-extrabold text-2xl tracking-tight text-[#f0f0f5] hover:opacity-80 transition-opacity">
          feed
          <span className="text-[var(--accent-thread)]">.</span>
          silo
        </Link>
      </div>

      {/* Heading */}
      <h1 className="font-heading font-extrabold text-2xl tracking-tight text-[#f0f0f5] text-center mb-6">
        Login
      </h1>

      <form action={loginAction} className="flex flex-col gap-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <div>
          <label className="text-[13px] font-medium text-[#f0f0f5] mb-2 block">
            Email
          </label>
          <input
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            className="w-full h-10 px-4 rounded-[10px] bg-[#0a0a0f] border border-[#ffffff12] text-[#f0f0f5] text-sm placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-[#ffffff30] transition-colors"
          />
        </div>

        <div>
          <label className="text-[13px] font-medium text-[#f0f0f5] mb-2 block">
            Password
          </label>
          <input
            name="password"
            type="password"
            placeholder="Enter your password"
            required
            className="w-full h-10 px-4 rounded-[10px] bg-[#0a0a0f] border border-[#ffffff12] text-[#f0f0f5] text-sm placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-[#ffffff30] transition-colors"
          />
        </div>

        {error && (
          <p className="text-[#ff4444] text-sm text-center">{error}</p>
        )}

        <SubmitButton />
      </form>
    </div>
  );
}
