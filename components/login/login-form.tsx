"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { bootstrapAdminAction, loginAction } from "@/lib/auth/actions";
import { BrandWordmark } from "@/components/brand-wordmark";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="mt-2 inline-flex h-12 items-center justify-center rounded-[16px] border border-[#cfb28a55] bg-[#b89462] px-8 font-heading text-[15px] font-semibold text-[#10141a] shadow-[0_16px_40px_rgba(184,148,98,0.24)] transition-all duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8c0a0] disabled:cursor-default disabled:opacity-30 disabled:hover:brightness-100"
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

  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleDemoLogin = () => {
    if (emailRef.current && passwordRef.current && formRef.current) {
      emailRef.current.value = demoEmail || "";
      passwordRef.current.value = demoPassword || "";
      formRef.current.requestSubmit();
    }
  };

  return (
    <div className="w-full rounded-[28px] border border-[#d6c9b214] bg-[#ffffff08] p-6 sm:p-7">
      <div className="mb-6 text-center">
        <Link
          href="/"
          className="font-heading text-2xl font-semibold tracking-[-0.05em] text-[#f2ede5] transition-opacity hover:opacity-80"
        >
          <BrandWordmark className="text-[1em]" />
        </Link>
      </div>

      <h1 className="text-center font-heading text-[2rem] font-semibold tracking-[-0.05em] text-[#f2ede5]">
        {bootstrapMode ? "Create admin account" : "Sign in"}
      </h1>
      <p className="mt-2 text-center text-sm leading-7 text-[#b4ab9d]">
        {bootstrapMode
          ? "This is the first run for this hosted instance. Create the local admin account once and you are in."
          : "Unlock settings and admin surfaces for this local instance."}
      </p>

      <form ref={formRef} action={bootstrapMode ? bootstrapAdminAction : loginAction} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <div>
          <label className="mb-2 block text-[13px] font-medium text-[#e7e0d5]">
            Email
          </label>
          <input
            ref={emailRef}
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
            ref={passwordRef}
            name="password"
            type="password"
            placeholder="Enter your password"
            required
            className="h-11 w-full rounded-[16px] border border-[#d6c9b21f] bg-[#0f141b] px-4 text-sm text-[#f2ede5] placeholder:text-[#7d7569] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
          />
        </div>

        {bootstrapMode && (
          <div>
            <label className="mb-2 block text-[13px] font-medium text-[#e7e0d5]">
              Confirm password
            </label>
            <input
              name="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              required
              className="h-11 w-full rounded-[16px] border border-[#d6c9b21f] bg-[#0f141b] px-4 text-sm text-[#f2ede5] placeholder:text-[#7d7569] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
            />
          </div>
        )}

        {error && (
          <p className="rounded-[14px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
            {error}
          </p>
        )}

        <SubmitButton
          label={bootstrapMode ? "Create admin account" : "Sign In"}
          pendingLabel={bootstrapMode ? "Creating account..." : "Signing in..."}
        />
      </form>

      {demoEmail && demoPassword && !bootstrapMode && (
        <>
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#d6c9b214]" />
            <span className="text-[11px] uppercase tracking-[0.14em] text-[#7d7569]">or try the demo</span>
            <div className="h-px flex-1 bg-[#d6c9b214]" />
          </div>

          <div className="rounded-[16px] border border-[#d6c9b214] bg-[#ffffff06] p-4">
            <p className="mb-3 text-sm text-[#b4ab9d]">
              Browse a pre-loaded library with 300+ captured tweets, articles, and RSS items.
            </p>
            <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-[10px] bg-[#ffffff08] px-3 py-2">
                <span className="text-[#7d7569]">Email:</span>{" "}
                <span className="font-mono text-[#cdc4b7]">{demoEmail}</span>
              </div>
              <div className="rounded-[10px] bg-[#ffffff08] px-3 py-2">
                <span className="text-[#7d7569]">Password:</span>{" "}
                <span className="font-mono text-[#cdc4b7]">{demoPassword}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              className="w-full rounded-[12px] border border-[#d6c9b21a] bg-[#ffffff0a] px-4 py-2.5 text-sm font-medium text-[#e7e0d5] transition-colors hover:bg-[#ffffff14]"
            >
              Log in as Demo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
