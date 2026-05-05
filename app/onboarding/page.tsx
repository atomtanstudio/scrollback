import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingPage } from "@/components/onboarding/onboarding-page";
import { getConfig, isConfigured } from "@/lib/config";
import { getClient } from "@/lib/db/client";

export const metadata: Metadata = {
  title: "Setup — Scrollback",
  description: "Set up your Scrollback instance",
};

export default async function Page() {
  if (isConfigured(getConfig())) {
    try {
      const db = await getClient();
      const userCount = await db.user.count();
      if (userCount > 0) {
        redirect("/");
      }
    } catch {
      // Keep onboarding accessible if setup is only partially complete.
    }
  }
  return <OnboardingPage />;
}
