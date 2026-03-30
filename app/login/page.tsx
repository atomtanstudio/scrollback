import { Suspense } from "react";
import { LoginForm } from "@/components/login/login-form";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandWordmark } from "@/components/brand-wordmark";
import { getConfig, isConfigured } from "@/lib/config";
import { hasAdminUsers } from "@/lib/auth/bootstrap";

export const metadata: Metadata = { title: "Login — FeedSilo" };

export default async function LoginPage() {
  let bootstrapMode = false;

  if (isConfigured(getConfig())) {
    try {
      bootstrapMode = !(await hasAdminUsers());
    } catch {
      bootstrapMode = false;
    }
  }

  const demoEmail = process.env.DEMO_EMAIL || undefined;
  const demoPassword = process.env.DEMO_PASSWORD || undefined;
  const showDemo = !!(demoEmail && demoPassword);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090c11] px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="font-heading text-xl font-semibold tracking-[-0.05em] text-[#f2ede5] transition-opacity hover:opacity-80"
          >
            <BrandWordmark className="text-[1em]" />
          </Link>
          <Link
            href="/"
            className="text-sm text-[#7d7569] transition-colors hover:text-[#f2ede5]"
          >
            Back to library
          </Link>
        </div>

        <Suspense>
          <LoginForm
            bootstrapMode={bootstrapMode}
            demoEmail={showDemo ? demoEmail : undefined}
            demoPassword={showDemo ? demoPassword : undefined}
          />
        </Suspense>
      </div>
    </main>
  );
}
