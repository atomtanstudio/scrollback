"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth/auth";
import { createInitialAdmin } from "@/lib/auth/bootstrap";

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

export async function bootstrapAdminAction(formData: FormData) {
  const redirectTo = normalizeRedirectTarget(formData.get("callbackUrl"), "/admin");
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof email !== "string" || !email) {
    redirect(`/login?setupError=${encodeURIComponent("Email is required")}&callbackUrl=${encodeURIComponent(redirectTo)}`);
  }

  if (typeof password !== "string" || password.length < 8) {
    redirect(`/login?setupError=${encodeURIComponent("Password must be at least 8 characters")}&callbackUrl=${encodeURIComponent(redirectTo)}`);
  }

  if (password !== confirmPassword) {
    redirect(`/login?setupError=${encodeURIComponent("Passwords do not match")}&callbackUrl=${encodeURIComponent(redirectTo)}`);
  }

  try {
    await createInitialAdmin(email, password);
    await signIn("credentials", {
      email,
      password,
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=${encodeURIComponent(error.type)}&callbackUrl=${encodeURIComponent(redirectTo)}`);
    }

    const message = error instanceof Error ? error.message : "Unable to create admin account";
    redirect(`/login?setupError=${encodeURIComponent(message)}&callbackUrl=${encodeURIComponent(redirectTo)}`);
  }
}
