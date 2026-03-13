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
