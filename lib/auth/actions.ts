"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth/auth";

function normalizeRedirectTarget(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return fallback;
  }

  return value;
}

export async function loginAction(formData: FormData) {
  const redirectTo = normalizeRedirectTarget(formData.get("callbackUrl"), "/");
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=${encodeURIComponent(error.type)}&callbackUrl=${encodeURIComponent(redirectTo)}`);
    }

    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
