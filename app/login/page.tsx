import { LoginForm } from "@/components/login/login-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Login — FeedSilo" };

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <LoginForm />
    </div>
  );
}
