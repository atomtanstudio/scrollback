import type { Metadata } from "next";
import { OnboardingPage } from "@/components/onboarding/onboarding-page";

export const metadata: Metadata = {
  title: "Setup — FeedSilo",
  description: "Set up your FeedSilo instance",
};

export default function Page() {
  return <OnboardingPage />;
}
