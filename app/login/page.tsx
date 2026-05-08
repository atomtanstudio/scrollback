import { Suspense } from "react";
import { LoginForm } from "@/components/login/login-form";
import type { Metadata } from "next";
import { BrandWordmark } from "@/components/brand-wordmark";
import { getConfig, isConfigured } from "@/lib/config";
import { hasAdminUsers } from "@/lib/auth/bootstrap";

export const metadata: Metadata = { title: "Login — Scrollback" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
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
  const params = (await searchParams) || {};
  const autoDemoLogin =
    process.env.SCROLLBACK_PUBLIC_DEMO === "true" &&
    (Array.isArray(params.demo) ? params.demo[0] : params.demo) === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <BrandWordmark className="text-xl text-[#f2ede5]" />
        </div>

        <Suspense>
          <LoginForm
            bootstrapMode={bootstrapMode}
            demoEmail={showDemo ? demoEmail : undefined}
            demoPassword={showDemo ? demoPassword : undefined}
            autoDemoLogin={autoDemoLogin}
          />
        </Suspense>
      </div>
    </main>
  );
}
