import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingPage } from "@/components/onboarding/onboarding-page";
import { getConfig, isConfigured } from "@/lib/config";

export const metadata: Metadata = {
  title: "Setup — FeedSilo",
  description: "Set up your FeedSilo instance",
};

export default function Page() {
  if (isConfigured(getConfig())) {
    redirect("/");
  }
  return <OnboardingPage />;
}
