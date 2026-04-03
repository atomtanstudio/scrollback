"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { bootstrapAdminAction, loginAction } from "@/lib/auth/actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-[14px] border border-[#cfb28a55] bg-[#b89462] px-6 text-[14px] font-semibold text-[#10141a] shadow-[0_12px_32px_rgba(184,148,98,0.2)] transition-all duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462] disabled:cursor-default disabled:opacity-30 disabled:hover:brightness-100"
      disabled={pending}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

interface LoginFormProps {
  bootstrapMode?: boolean;
  demoEmail?: string;
  demoPassword?: string;
}

export function LoginForm({ bootstrapMode = false, demoEmail, demoPassword }: LoginFormProps) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";
  const errorParam = searchParams.get("error");
  const setupErrorParam = searchParams.get("setupError");
  const error = bootstrapMode
    ? setupErrorParam || ""
    : errorParam
      ? "Invalid email or password"
      : "";

  const showDemo = !!(demoEmail && demoPassword && !bootstrapMode);
  const [tab, setTab] = useState<"signin" | "demo">(showDemo ? "demo" : "signin");

  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[linear-gradient(180deg,rgba(24,29,37,0.96),rgba(14,18,24,0.98))] p-6 shadow-[0_24px_64px_rgba(2,6,12,0.4)]">
      {bootstrapMode ? (
        <>
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-[#f2ede5]">
            Create admin account
          </h1>
          <p className="mt-1 text-[13px] leading-6 text-[#8a8279]">
            First run — create the local admin account to unlock settings and admin.
          </p>
        </>
      ) : showDemo ? (
        <div className="flex gap-1 rounded-[10px] bg-[#ffffff08] p-1">
          <button
            type="button"
            onClick={() => setTab("demo")}
            className={`flex-1 rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === "demo"
                ? "bg-[#ffffff12] text-[#f2ede5]"
                : "text-[#7d7569] hover:text-[#a49b8b]"
            }`}
          >
            Try the demo
          </button>
          <button
            type="button"
            onClick={() => setTab("signin")}
            className={`flex-1 rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === "signin"
                ? "bg-[#ffffff12] text-[#f2ede5]"
                : "text-[#7d7569] hover:text-[#a49b8b]"
            }`}
          >
            Sign in
          </button>
        </div>
      ) : (
        <h1 className="text-lg font-semibold tracking-[-0.02em] text-[#f2ede5]">
          Sign in
        </h1>
      )}

      {tab === "demo" && showDemo ? (
        <div className="mt-5">
          <p className="text-[13px] leading-6 text-[#8a8279]">
            Browse a pre-loaded library with captured tweets, articles, and RSS items. Read-only access.
          </p>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-[10px] bg-[#ffffff08] px-3 py-2 text-[13px]">
              <span className="text-[#7d7569]">Email</span>
              <span className="font-mono text-[#cdc4b7]">{demoEmail}</span>
            </div>
            <div className="flex items-center justify-between rounded-[10px] bg-[#ffffff08] px-3 py-2 text-[13px]">
              <span className="text-[#7d7569]">Password</span>
              <span className="font-mono text-[#cdc4b7]">{demoPassword}</span>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-[10px] border border-red-500/20 bg-red-500/10 px-3 py-2 text-center text-[13px] text-red-300">
              {error}
            </p>
          )}

          <form action={loginAction}>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <input type="hidden" name="email" value={demoEmail} />
            <input type="hidden" name="password" value={demoPassword} />
            <SubmitButton label="Log in as demo" pendingLabel="Logging in..." />
          </form>
        </div>
      ) : (
        <form action={bootstrapMode ? bootstrapAdminAction : loginAction} className="mt-5 flex flex-col gap-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#e7e0d5]">
              Email
            </label>
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              className="h-10 w-full rounded-[14px] border border-[#d6c9b21f] bg-[#0f141b] px-4 text-sm text-[#f2ede5] placeholder:text-[#7d7569] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#e7e0d5]">
              Password
            </label>
            <input
              name="password"
              type="password"
              placeholder="Enter your password"
              required
              className="h-10 w-full rounded-[14px] border border-[#d6c9b21f] bg-[#0f141b] px-4 text-sm text-[#f2ede5] placeholder:text-[#7d7569] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
            />
          </div>

          {bootstrapMode && (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#e7e0d5]">
                Confirm password
              </label>
              <input
                name="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                required
                className="h-10 w-full rounded-[14px] border border-[#d6c9b21f] bg-[#0f141b] px-4 text-sm text-[#f2ede5] placeholder:text-[#7d7569] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
              />
            </div>
          )}

          {error && (
            <p className="rounded-[10px] border border-red-500/20 bg-red-500/10 px-3 py-2 text-center text-[13px] text-red-300">
              {error}
            </p>
          )}

          <SubmitButton
            label={bootstrapMode ? "Create admin account" : "Sign in"}
            pendingLabel={bootstrapMode ? "Creating account..." : "Signing in..."}
          />
        </form>
      )}
    </div>
  );
}
