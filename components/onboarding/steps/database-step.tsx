"use client";

import { DatabaseCard, type DatabaseChoice } from "../database-card";
import {
  onboardingHeadingClass,
  onboardingPrimaryButtonClass,
  onboardingSubheadingClass,
  StepBadge,
} from "../ui";

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
    accentColor: "#6e98a0",
  },
  {
    type: "postgresql",
    title: "PostgreSQL",
    description:
      "Self-hosted database. Full control, best performance, supports semantic search via pgvector.",
    badge: "Recommended",
    accentColor: "#8c7f9f",
  },
  {
    type: "supabase",
    title: "Supabase",
    description:
      "Managed PostgreSQL with built-in vector search. Easiest cloud option with generous free tier.",
    badge: "Best for Cloud",
    accentColor: "#b89462",
  },
];

export function DatabaseStep({
  selected,
  onSelect,
  onContinue,
}: DatabaseStepProps) {
  return (
    <div className="flex flex-col items-center">
      <StepBadge tone="recommended">Choose storage</StepBadge>
      <h2 className={onboardingHeadingClass}>
        Where should FeedSilo store your data?
      </h2>
      <p className={`${onboardingSubheadingClass} mb-8 mt-4 text-center`}>
        You can always switch later from the settings page
      </p>

      <div className="mb-8 flex w-full flex-col gap-3">
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
        className={onboardingPrimaryButtonClass}
      >
        Continue
      </button>
    </div>
  );
}
