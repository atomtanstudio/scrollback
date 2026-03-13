# Session 3 Chunk 2: Onboarding Flow — Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 4-step onboarding wizard that guides users from `git clone` to first captured tweet, with Framer Motion transitions, three database path UIs, and a browser extension pairing step.

**Architecture:** Single client component (`app/onboarding/page.tsx`) with step state in `sessionStorage`. Shared layout component with progress indicator. Each step is a separate component composed inside AnimatePresence for slide transitions. Steps call the Chunk 1 API endpoints (`/api/setup/status`, `/api/setup/test-connection`, `/api/setup/migrate`).

**Tech Stack:** Next.js 14 App Router, React, Framer Motion, Tailwind CSS, canvas-confetti

**Spec:** `docs/superpowers/specs/2026-03-12-session3-onboarding-settings-design.md` (Chunk 2 section, lines 159-237)

---

## File Structure

### Files to Create

| File | Responsibility |
|------|---------------|
| `app/onboarding/page.tsx` | Server shell — metadata, renders OnboardingPage client component |
| `components/onboarding/onboarding-page.tsx` | Client component — step state, sessionStorage, AnimatePresence |
| `components/onboarding/onboarding-layout.tsx` | Progress dots (4), centered container, back button |
| `components/onboarding/database-card.tsx` | Selectable card with accent color, badge, glow state |
| `components/onboarding/steps/welcome-step.tsx` | Logo, headline, bullets, "Get Started" CTA |
| `components/onboarding/steps/database-step.tsx` | 3 DatabaseCards, Continue button |
| `components/onboarding/steps/configure-step.tsx` | Conditional forms (SQLite/PG/Supabase), ConnectionTester |
| `components/onboarding/steps/extension-step.tsx` | Token display, copy, confetti, "Open FeedSilo" |
| `components/shared/connection-tester.tsx` | Button → spinner → checkmark/error, pgvector status |
| `components/shared/token-display.tsx` | Monospace token, copy button, "Copied!" flash |

---

## Task 1: Onboarding Layout + Page Shell

**Files:**
- Create: `app/onboarding/page.tsx`
- Create: `components/onboarding/onboarding-page.tsx`
- Create: `components/onboarding/onboarding-layout.tsx`

- [ ] **Step 1: Create the page shell**

Create `app/onboarding/page.tsx`:

```tsx
import type { Metadata } from "next";
import { OnboardingPage } from "@/components/onboarding/onboarding-page";

export const metadata: Metadata = {
  title: "Setup — FeedSilo",
  description: "Set up your FeedSilo instance",
};

export default function Page() {
  return <OnboardingPage />;
}
```

- [ ] **Step 2: Create OnboardingLayout**

Create `components/onboarding/onboarding-layout.tsx`:

```tsx
"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OnboardingLayoutProps {
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  children: ReactNode;
}

export function OnboardingLayout({
  currentStep,
  totalSteps,
  onBack,
  children,
}: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-10">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              i + 1 === currentStep
                ? "bg-[var(--accent-thread)] w-6"
                : i + 1 < currentStep
                  ? "bg-[var(--accent-thread)] opacity-60"
                  : "bg-[hsl(var(--muted))]"
            )}
          />
        ))}
      </div>

      {/* Content container */}
      <div className="w-full max-w-[640px] relative">
        {/* Back button */}
        {onBack && currentStep > 1 && (
          <button
            onClick={onBack}
            className="absolute -top-8 left-0 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors flex items-center gap-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}

        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create OnboardingPage with step state and AnimatePresence**

Create `components/onboarding/onboarding-page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { OnboardingLayout } from "./onboarding-layout";
import { WelcomeStep } from "./steps/welcome-step";
import { DatabaseStep, type DatabaseChoice } from "./steps/database-step";
import { ConfigureStep } from "./steps/configure-step";
import { ExtensionStep } from "./steps/extension-step";

const STORAGE_KEY = "feedsilo-onboarding-step";
const DB_STORAGE_KEY = "feedsilo-onboarding-db";

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

const slideTransition = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1],
};

export function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [dbChoice, setDbChoice] = useState<DatabaseChoice | null>(null);
  const [mounted, setMounted] = useState(false);

  // Hydrate from sessionStorage
  useEffect(() => {
    const savedStep = sessionStorage.getItem(STORAGE_KEY);
    const savedDb = sessionStorage.getItem(DB_STORAGE_KEY);
    if (savedStep) setStep(parseInt(savedStep, 10));
    if (savedDb) setDbChoice(savedDb as DatabaseChoice);
    setMounted(true);
  }, []);

  // Persist step to sessionStorage
  useEffect(() => {
    if (mounted) {
      sessionStorage.setItem(STORAGE_KEY, String(step));
      if (dbChoice) sessionStorage.setItem(DB_STORAGE_KEY, dbChoice);
    }
  }, [step, dbChoice, mounted]);

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, 4));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleDbSelect = useCallback(
    (choice: DatabaseChoice) => {
      setDbChoice(choice);
    },
    []
  );

  if (!mounted) return null; // Avoid hydration mismatch

  return (
    <OnboardingLayout
      currentStep={step}
      totalSteps={4}
      onBack={step > 1 ? goBack : undefined}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={slideTransition}
        >
          {step === 1 && <WelcomeStep onContinue={goNext} />}
          {step === 2 && (
            <DatabaseStep
              selected={dbChoice}
              onSelect={handleDbSelect}
              onContinue={goNext}
            />
          )}
          {step === 3 && dbChoice && (
            <ConfigureStep dbType={dbChoice} onContinue={goNext} />
          )}
          {step === 4 && <ExtensionStep />}
        </motion.div>
      </AnimatePresence>
    </OnboardingLayout>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/onboarding/page.tsx components/onboarding/onboarding-page.tsx components/onboarding/onboarding-layout.tsx
git commit -m "feat: add onboarding page shell with step state and animated transitions"
```

---

## Task 2: Welcome Step

**Files:**
- Create: `components/onboarding/steps/welcome-step.tsx`

- [ ] **Step 1: Create WelcomeStep**

Create `components/onboarding/steps/welcome-step.tsx`:

```tsx
"use client";

interface WelcomeStepProps {
  onContinue: () => void;
}

export function WelcomeStep({ onContinue }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Logo */}
      <div className="font-heading font-semibold text-[32px] tracking-tight text-[#f0f0f5] flex items-center mb-4">
        feed
        <span className="inline-block w-[7px] h-[7px] rounded-full bg-[var(--accent-thread)] mx-[2px] relative top-[1px]" />
        silo
      </div>

      {/* Headline */}
      <h1 className="font-heading font-extrabold text-4xl md:text-5xl tracking-[-1.8px] text-[#f0f0f5] mb-3">
        Your personal content
        <br />
        intelligence feed
      </h1>

      <p className="text-[hsl(var(--muted-foreground))] text-lg mb-10 max-w-[480px]">
        Capture tweets, threads, and articles from your browser.
        Search, organize, and rediscover what matters.
      </p>

      {/* Bullets */}
      <div className="flex flex-col gap-4 mb-10 text-left max-w-[400px] w-full">
        <div className="flex items-start gap-3">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-tweet)] mt-2 shrink-0" />
          <span className="text-[#f0f0f5]">
            <strong>Capture</strong> — Save tweets, threads, and articles with one click
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-thread)] mt-2 shrink-0" />
          <span className="text-[#f0f0f5]">
            <strong>Search</strong> — Full-text and semantic search across everything
          </span>
        </div>
        <div className="flex items-start gap-3">
          <span className="w-2 h-2 rounded-full bg-[var(--accent-article)] mt-2 shrink-0" />
          <span className="text-[#f0f0f5]">
            <strong>Own your data</strong> — Self-hosted, open source, MIT licensed
          </span>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onContinue}
        className="h-12 px-8 rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold text-[15px] hover:brightness-110 transition-all duration-200 cursor-pointer"
      >
        Get Started
      </button>

      <p className="text-xs text-[hsl(var(--muted))] mt-6">
        Open source, MIT licensed, your data stays yours
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/onboarding/steps/welcome-step.tsx
git commit -m "feat: add welcome step with logo, headline, and feature bullets"
```

---

## Task 3: Database Card + Database Step

**Files:**
- Create: `components/onboarding/database-card.tsx`
- Create: `components/onboarding/steps/database-step.tsx`

- [ ] **Step 1: Create DatabaseCard**

Create `components/onboarding/database-card.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";

export type DatabaseChoice = "sqlite" | "postgresql" | "supabase";

interface DatabaseCardProps {
  type: DatabaseChoice;
  title: string;
  description: string;
  badge: string;
  accentColor: string;
  selected: boolean;
  onSelect: () => void;
}

export function DatabaseCard({
  title,
  description,
  badge,
  accentColor,
  selected,
  onSelect,
}: DatabaseCardProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-[14px] p-px transition-all duration-200 cursor-pointer",
        selected
          ? "shadow-[0_0_20px_-4px_var(--glow)]"
          : "opacity-60 hover:opacity-80"
      )}
      style={{
        background: selected
          ? `linear-gradient(135deg, ${accentColor}40, ${accentColor}15, transparent)`
          : "hsl(var(--border))",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ["--glow" as any]: accentColor,
      }}
    >
      <div
        className={cn(
          "rounded-[13px] p-5 transition-all duration-200",
          selected ? "bg-[#111118]" : "bg-[#0e1018]"
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-heading font-semibold text-[15px] text-[#f0f0f5]">
            {title}
          </h3>
          <span
            className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
            style={{
              backgroundColor: `${accentColor}18`,
              color: accentColor,
            }}
          >
            {badge}
          </span>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {description}
        </p>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Create DatabaseStep**

Create `components/onboarding/steps/database-step.tsx`:

```tsx
"use client";

import { DatabaseCard, type DatabaseChoice } from "../database-card";

export type { DatabaseChoice };

interface DatabaseStepProps {
  selected: DatabaseChoice | null;
  onSelect: (choice: DatabaseChoice) => void;
  onContinue: () => void;
}

const DATABASE_OPTIONS: Array<{
  type: DatabaseChoice;
  title: string;
  description: string;
  badge: string;
  accentColor: string;
}> = [
  {
    type: "sqlite",
    title: "Local SQLite",
    description:
      "Zero infrastructure. Everything stored locally. Best for personal use and quick setup.",
    badge: "Fastest Setup",
    accentColor: "#22d3ee",
  },
  {
    type: "postgresql",
    title: "PostgreSQL",
    description:
      "Self-hosted database. Full control, best performance, supports semantic search via pgvector.",
    badge: "Recommended",
    accentColor: "#a78bfa",
  },
  {
    type: "supabase",
    title: "Supabase",
    description:
      "Managed PostgreSQL with built-in vector search. Easiest cloud option with generous free tier.",
    badge: "Best for Cloud",
    accentColor: "#fb923c",
  },
];

export function DatabaseStep({
  selected,
  onSelect,
  onContinue,
}: DatabaseStepProps) {
  return (
    <div className="flex flex-col items-center">
      <h2 className="font-heading font-extrabold text-2xl md:text-3xl tracking-tight text-[#f0f0f5] mb-2 text-center">
        Where should FeedSilo store your data?
      </h2>
      <p className="text-[hsl(var(--muted-foreground))] text-sm mb-8 text-center">
        You can always switch later from the settings page
      </p>

      <div className="flex flex-col gap-3 w-full mb-8">
        {DATABASE_OPTIONS.map((opt) => (
          <DatabaseCard
            key={opt.type}
            type={opt.type}
            title={opt.title}
            description={opt.description}
            badge={opt.badge}
            accentColor={opt.accentColor}
            selected={selected === opt.type}
            onSelect={() => onSelect(opt.type)}
          />
        ))}
      </div>

      <button
        onClick={onContinue}
        disabled={!selected}
        className="h-12 px-8 rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold text-[15px] hover:brightness-110 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:brightness-100"
      >
        Continue
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/database-card.tsx components/onboarding/steps/database-step.tsx
git commit -m "feat: add database card and database selection step"
```

---

## Task 4: Shared Components (ConnectionTester + TokenDisplay)

**Files:**
- Create: `components/shared/connection-tester.tsx`
- Create: `components/shared/token-display.tsx`

- [ ] **Step 1: Create ConnectionTester**

Create `components/shared/connection-tester.tsx`:

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ConnectionTesterProps {
  onTest: () => Promise<{ connected: boolean; pgvector: boolean; error?: string }>;
  className?: string;
}

type TestState = "idle" | "testing" | "success" | "error";

export function ConnectionTester({ onTest, className }: ConnectionTesterProps) {
  const [state, setState] = useState<TestState>("idle");
  const [pgvector, setPgvector] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    setState("testing");
    setError(null);
    try {
      const result = await onTest();
      if (result.connected) {
        setState("success");
        setPgvector(result.pgvector);
      } else {
        setState("error");
        setError(result.error || "Connection failed");
      }
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <button
        onClick={handleTest}
        disabled={state === "testing"}
        className={cn(
          "h-10 px-5 rounded-[10px] text-sm font-medium transition-all duration-200 cursor-pointer",
          state === "success"
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : state === "error"
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "bg-[#1a1a24] text-[#f0f0f5] border border-[#ffffff12] hover:border-[#ffffff24]",
          state === "testing" && "opacity-70"
        )}
      >
        {state === "testing" && (
          <span className="inline-flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Testing...
          </span>
        )}
        {state === "idle" && "Test Connection"}
        {state === "success" && (
          <span className="inline-flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Connected
          </span>
        )}
        {state === "error" && "Retry Connection"}
      </button>

      {/* pgvector status */}
      {state === "success" && !pgvector && (
        <div className="flex items-start gap-2 text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            pgvector extension not found. Semantic search will be unavailable.{" "}
            <a href="https://github.com/pgvector/pgvector#installation" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-300">
              Install pgvector
            </a>
          </span>
        </div>
      )}

      {state === "success" && pgvector && (
        <p className="text-xs text-emerald-400/80">pgvector detected — semantic search enabled</p>
      )}

      {/* Error message */}
      {state === "error" && error && (
        <p className="text-xs text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create TokenDisplay**

Create `components/shared/token-display.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TokenDisplayProps {
  token: string;
  className?: string;
}

export function TokenDisplay({ token, className }: TokenDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [token]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <code className="flex-1 bg-[#0a0a0f] border border-[#ffffff12] rounded-lg px-4 py-3 font-mono text-sm text-[var(--accent-tweet)] select-all break-all">
        {token}
      </code>
      <button
        onClick={handleCopy}
        className="shrink-0 h-10 px-4 rounded-[10px] text-sm font-medium bg-[#1a1a24] border border-[#ffffff12] text-[#f0f0f5] hover:border-[#ffffff24] transition-all duration-200 cursor-pointer"
      >
        {copied ? (
          <span className="text-emerald-400">Copied!</span>
        ) : (
          "Copy"
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/shared/connection-tester.tsx components/shared/token-display.tsx
git commit -m "feat: add shared ConnectionTester and TokenDisplay components"
```

---

## Task 5: Configure Step (SQLite + PostgreSQL + Supabase forms)

**Files:**
- Create: `components/onboarding/steps/configure-step.tsx`

- [ ] **Step 1: Create ConfigureStep**

Create `components/onboarding/steps/configure-step.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ConnectionTester } from "@/components/shared/connection-tester";
import type { DatabaseChoice } from "../database-card";

interface ConfigureStepProps {
  dbType: DatabaseChoice;
  onContinue: () => void;
}

export function ConfigureStep({ dbType, onContinue }: ConfigureStepProps) {
  return (
    <div className="flex flex-col items-center">
      <h2 className="font-heading font-extrabold text-2xl md:text-3xl tracking-tight text-[#f0f0f5] mb-2 text-center">
        Configure your connection
      </h2>
      <p className="text-[hsl(var(--muted-foreground))] text-sm mb-8 text-center">
        {dbType === "sqlite" && "Almost there — SQLite needs no external database"}
        {dbType === "postgresql" && "Enter your PostgreSQL connection details"}
        {dbType === "supabase" && "Enter your Supabase project details"}
      </p>

      {dbType === "sqlite" && <SqliteForm onContinue={onContinue} />}
      {dbType === "postgresql" && <PostgresForm onContinue={onContinue} />}
      {dbType === "supabase" && <SupabaseForm onContinue={onContinue} />}
    </div>
  );
}

// ─── Input helper ────────────────────────────────────────
function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  note,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-[13px] font-medium text-[#f0f0f5]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 px-4 rounded-[10px] bg-[#0a0a0f] border border-[#ffffff12] text-[#f0f0f5] text-sm placeholder:text-[hsl(var(--muted))] focus:outline-none focus:border-[#ffffff30] transition-colors"
      />
      {note && <p className="text-xs text-[hsl(var(--muted-foreground))]">{note}</p>}
    </div>
  );
}

// ─── SQLite Form ─────────────────────────────────────────
function SqliteForm({ onContinue }: { onContinue: () => void }) {
  const [filePath, setFilePath] = useState("./feedsilo.db");
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setMigrating(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: { type: "sqlite", url: `file:${filePath}` },
        }),
      });
      const data = await res.json();
      if (data.success) {
        onContinue();
      } else {
        setError(data.error || "Migration failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <InputField
        label="Database file path"
        value={filePath}
        onChange={setFilePath}
        placeholder="./feedsilo.db"
        note="Your database file will be created automatically"
      />

      {error && (
        <p className="text-xs text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={handleContinue}
        disabled={migrating || !filePath}
        className="h-12 px-8 rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold text-[15px] hover:brightness-110 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed self-center mt-2"
      >
        {migrating ? "Setting up..." : "Continue"}
      </button>
    </div>
  );
}

// ─── PostgreSQL Form ─────────────────────────────────────
function PostgresForm({ onContinue }: { onContinue: () => void }) {
  const [connectionString, setConnectionString] = useState("");
  const [showFields, setShowFields] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("feedsilo");
  const [username, setUsername] = useState("postgres");
  const [password, setPassword] = useState("");
  const [tested, setTested] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getConnectionUrl = () => {
    if (connectionString) return connectionString;
    if (host) {
      const pass = password ? `:${password}` : "";
      return `postgresql://${username}${pass}@${host}:${port}/${database}`;
    }
    return "";
  };

  const hasInput = connectionString || host;

  const handleTest = async () => {
    const url = getConnectionUrl();
    const res = await fetch("/api/setup/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "postgresql", url }),
    });
    const data = await res.json();
    if (data.connected) setTested(true);
    return data;
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setError(null);
    try {
      const url = getConnectionUrl();
      const res = await fetch("/api/setup/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: { type: "postgresql", url },
        }),
      });
      const data = await res.json();
      if (data.success) {
        onContinue();
      } else {
        setError(data.error || "Migration failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {!showFields ? (
        <>
          <InputField
            label="Connection string"
            value={connectionString}
            onChange={setConnectionString}
            placeholder="postgresql://user:pass@localhost:5432/feedsilo"
          />
          <button
            onClick={() => setShowFields(true)}
            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[#f0f0f5] transition-colors self-start cursor-pointer"
          >
            Enter fields separately
          </button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Host" value={host} onChange={setHost} placeholder="localhost" />
            <InputField label="Port" value={port} onChange={setPort} placeholder="5432" />
          </div>
          <InputField label="Database" value={database} onChange={setDatabase} placeholder="feedsilo" />
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Username" value={username} onChange={setUsername} placeholder="postgres" />
            <InputField label="Password" value={password} onChange={setPassword} type="password" placeholder="password" />
          </div>
          <button
            onClick={() => setShowFields(false)}
            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[#f0f0f5] transition-colors self-start cursor-pointer"
          >
            Use connection string instead
          </button>
        </>
      )}

      {hasInput && <ConnectionTester onTest={handleTest} />}

      {error && (
        <p className="text-xs text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {tested && (
        <button
          onClick={handleMigrate}
          disabled={migrating}
          className="h-12 px-8 rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold text-[15px] hover:brightness-110 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed self-center mt-2"
        >
          {migrating ? "Setting up database..." : "Continue"}
        </button>
      )}
    </div>
  );
}

// ─── Supabase Form ───────────────────────────────────────
function SupabaseForm({ onContinue }: { onContinue: () => void }) {
  const [connectionString, setConnectionString] = useState("");
  const [tested, setTested] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    const res = await fetch("/api/setup/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "supabase", url: connectionString }),
    });
    const data = await res.json();
    if (data.connected) setTested(true);
    return data;
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: { type: "supabase", url: connectionString },
        }),
      });
      const data = await res.json();
      if (data.success) {
        onContinue();
      } else {
        setError(data.error || "Migration failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <InputField
        label="PostgreSQL connection string"
        value={connectionString}
        onChange={setConnectionString}
        placeholder="postgresql://postgres.[ref]:[pass]@[host]:5432/postgres"
        note="Find this in your Supabase dashboard under Project Settings → Database → Connection string (URI)"
      />

      <a
        href="https://supabase.com/dashboard"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-[var(--accent-article)] hover:underline self-start"
      >
        Open Supabase Dashboard →
      </a>

      {connectionString && <ConnectionTester onTest={handleTest} />}

      {error && (
        <p className="text-xs text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {tested && (
        <button
          onClick={handleMigrate}
          disabled={migrating}
          className="h-12 px-8 rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold text-[15px] hover:brightness-110 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed self-center mt-2"
        >
          {migrating ? "Setting up database..." : "Continue"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/onboarding/steps/configure-step.tsx
git commit -m "feat: add configure step with SQLite, PostgreSQL, and Supabase forms"
```

---

## Task 6: Extension Step (Token + Confetti)

**Files:**
- Create: `components/onboarding/steps/extension-step.tsx`

- [ ] **Step 1: Create ExtensionStep**

Create `components/onboarding/steps/extension-step.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { TokenDisplay } from "@/components/shared/token-display";

export function ExtensionStep() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  // Generate pairing token on mount
  useEffect(() => {
    const generated = uuidv4();
    setToken(generated);
  }, []);

  const handleFinish = useCallback(async () => {
    setSaving(true);
    try {
      // Save the pairing token to config
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extension: { pairingToken: token },
        }),
      });
    } catch {
      // Non-fatal — token can be configured later
    }

    // Fire confetti
    try {
      const confetti = (await import("canvas-confetti")).default;
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#22d3ee", "#a78bfa", "#fb923c", "#ec4899"],
      });
    } catch {
      // Non-fatal
    }

    // Clear onboarding state and redirect
    sessionStorage.removeItem("feedsilo-onboarding-step");
    sessionStorage.removeItem("feedsilo-onboarding-db");

    setTimeout(() => {
      router.push("/");
    }, 1500);
  }, [token, router]);

  const handleSkip = useCallback(() => {
    sessionStorage.removeItem("feedsilo-onboarding-step");
    sessionStorage.removeItem("feedsilo-onboarding-db");
    router.push("/");
  }, [router]);

  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="font-heading font-extrabold text-2xl md:text-3xl tracking-tight text-[#f0f0f5] mb-2">
        Connect the browser extension
      </h2>
      <p className="text-[hsl(var(--muted-foreground))] text-sm mb-8 max-w-[480px]">
        The FeedSilo browser extension captures tweets, threads, and articles
        with one click. Copy this token and paste it in the extension settings.
      </p>

      {token && (
        <div className="w-full mb-6">
          <label className="text-[13px] font-medium text-[#f0f0f5] mb-2 block text-left">
            Pairing token
          </label>
          <TokenDisplay token={token} />
        </div>
      )}

      <div className="flex flex-col items-center gap-3 w-full">
        <button
          onClick={handleFinish}
          disabled={saving}
          className="h-12 px-8 rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold text-[15px] hover:brightness-110 transition-all duration-200 cursor-pointer disabled:opacity-30"
        >
          {saving ? "Finishing..." : "Open FeedSilo"}
        </button>

        <button
          onClick={handleSkip}
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[#f0f0f5] transition-colors cursor-pointer"
        >
          I&apos;ll do this later
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/onboarding/steps/extension-step.tsx
git commit -m "feat: add extension step with token display and confetti animation"
```

---

## Task 7: Verification

- [ ] **Step 1: Run build**

Run: `npm run build 2>&1 | grep -E "(Compiled|Failed|Error)"`
Expected: `✓ Compiled successfully`

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All existing tests pass (no new tests for UI components)

- [ ] **Step 3: Visual smoke test**

Run: `npm run dev` and visit `http://localhost:3000/onboarding`
Expected:
- Step 1: Welcome page with logo, headline, bullets, "Get Started" button
- Step 2: Three database cards (SQLite/PG/Supabase) with glow on select
- Step 3: Conditional form matching selected database
- Step 4: Pairing token with copy and confetti
- Slide transitions between steps (left/right)
- Back button works, progress dots update
- Browser refresh preserves step (sessionStorage)

- [ ] **Step 4: Commit fixes if needed**

```bash
git add -A
git commit -m "fix: address build/visual issues from onboarding implementation"
```
