"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  onboardingHeadingClass,
  onboardingInputClass,
  onboardingLabelClass,
  onboardingNoteClass,
  onboardingPrimaryButtonClass,
  onboardingSubheadingClass,
  StepBadge,
} from "../ui";

interface AccountStepProps {
  onContinue: () => void;
}

export function AccountStep({ onContinue }: AccountStepProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const passwordsMatch = password === confirmPassword;
  const passwordLongEnough = password.length >= 8;
  const canSubmit =
    email && password && confirmPassword && passwordsMatch && passwordLongEnough;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const signInResult = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (signInResult?.error) {
          setError("Account created, but automatic sign-in failed. Please sign in from the login page.");
          return;
        }

        onContinue();
      } else {
        setError(data.error || "Failed to create account");
      }
    } catch {
      setError("Connection failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      <StepBadge tone="recommended">Required</StepBadge>

      <h2 className={onboardingHeadingClass}>Create Admin Account</h2>
      <p className={`${onboardingSubheadingClass} mb-8 mt-4 max-w-[480px]`}>
        Set up your login credentials before continuing. FeedSilo protects your
        archive, settings, and extension token behind this account.
      </p>

      <div className="mb-4 flex w-full max-w-[480px] flex-col gap-4">
        <div>
          <label className={onboardingLabelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            placeholder="you@example.com"
            className={onboardingInputClass}
          />
        </div>

        <div>
          <label className={onboardingLabelClass}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="Minimum 8 characters"
            className={onboardingInputClass}
          />
          {password && !passwordLongEnough && (
            <p className="mt-1 text-left text-xs text-red-300">
              Password must be at least 8 characters
            </p>
          )}
        </div>

        <div>
          <label className={onboardingLabelClass}>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError("");
            }}
            placeholder="Re-enter your password"
            className={onboardingInputClass}
          />
          {confirmPassword && !passwordsMatch && (
            <p className="mt-1 text-left text-xs text-red-300">
              Passwords do not match
            </p>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

      <p className={`${onboardingNoteClass} mb-6 max-w-[400px]`}>
        Your credentials are stored locally in your database. Passwords are
        hashed with bcrypt and never stored in plain text.
      </p>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || saving}
        className={onboardingPrimaryButtonClass}
      >
        {saving ? "Creating..." : "Create Account & Continue"}
      </button>
    </div>
  );
}
