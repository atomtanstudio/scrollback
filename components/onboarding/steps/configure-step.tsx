"use client";

import { useState } from "react";
import { ConnectionTester } from "@/components/shared/connection-tester";
import type { DatabaseChoice } from "../database-card";
import {
  onboardingHeadingClass,
  onboardingInputClass,
  onboardingLabelClass,
  onboardingNoteClass,
  onboardingPrimaryButtonClass,
  onboardingSubheadingClass,
  onboardingTextButtonClass,
  StepBadge,
} from "../ui";

interface ConfigureStepProps {
  dbType: DatabaseChoice;
  setupToken: string;
  onContinue: () => void;
}

function setupHeaders(setupToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-scrollback-setup-token": setupToken,
  };
}

export function ConfigureStep({ dbType, setupToken, onContinue }: ConfigureStepProps) {
  return (
    <div className="flex flex-col items-center">
      <StepBadge tone="recommended">Connection</StepBadge>
      <h2 className={`${onboardingHeadingClass} text-center`}>
        Configure your connection
      </h2>
      <p className={`${onboardingSubheadingClass} mb-8 mt-4 text-center`}>
        {dbType === "sqlite" && "Almost there - SQLite needs no external database"}
        {dbType === "postgresql" && "Enter your PostgreSQL connection details"}
        {dbType === "supabase" && "Enter your Supabase project details"}
      </p>

      {dbType === "sqlite" && <SqliteForm setupToken={setupToken} onContinue={onContinue} />}
      {dbType === "postgresql" && <PostgresForm setupToken={setupToken} onContinue={onContinue} />}
      {dbType === "supabase" && <SupabaseForm setupToken={setupToken} onContinue={onContinue} />}
    </div>
  );
}

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
    <div className="flex w-full flex-col gap-1.5">
      <label className={onboardingLabelClass}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={onboardingInputClass}
      />
      {note && <p className={onboardingNoteClass}>{note}</p>}
    </div>
  );
}

function SqliteForm({ setupToken, onContinue }: { setupToken: string; onContinue: () => void }) {
  const [filePath, setFilePath] = useState("./scrollback.db");
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setMigrating(true);
    setError(null);
    try {
      const res = await fetch("/api/setup/migrate", {
        method: "POST",
        headers: setupHeaders(setupToken),
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
    <div className="flex w-full flex-col gap-4">
      <InputField
        label="Database file path"
        value={filePath}
        onChange={setFilePath}
        placeholder="./scrollback.db"
        note="Your database file will be created automatically"
      />

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300/90">
          {error}
        </p>
      )}

      <button
        onClick={handleContinue}
        disabled={migrating || !filePath}
        className={`${onboardingPrimaryButtonClass} mt-2 self-center`}
      >
        {migrating ? "Setting up..." : "Continue"}
      </button>
    </div>
  );
}

function PostgresForm({ setupToken, onContinue }: { setupToken: string; onContinue: () => void }) {
  const [connectionString, setConnectionString] = useState("");
  const [showFields, setShowFields] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("scrollback");
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
      headers: setupHeaders(setupToken),
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
        headers: setupHeaders(setupToken),
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
    <div className="flex w-full flex-col gap-4">
      {!showFields ? (
        <>
          <InputField
            label="Connection string"
            value={connectionString}
            onChange={setConnectionString}
            placeholder="postgresql://user:pass@localhost:5432/scrollback"
          />
          <button
            onClick={() => setShowFields(true)}
            className={`${onboardingTextButtonClass} self-start text-xs`}
          >
            Enter fields separately
          </button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Host"
              value={host}
              onChange={setHost}
              placeholder="localhost"
            />
            <InputField
              label="Port"
              value={port}
              onChange={setPort}
              placeholder="5432"
            />
          </div>
          <InputField
            label="Database"
            value={database}
            onChange={setDatabase}
            placeholder="scrollback"
          />
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Username"
              value={username}
              onChange={setUsername}
              placeholder="postgres"
            />
            <InputField
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              placeholder="password"
            />
          </div>
          <button
            onClick={() => setShowFields(false)}
            className={`${onboardingTextButtonClass} self-start text-xs`}
          >
            Use connection string instead
          </button>
        </>
      )}

      {hasInput && <ConnectionTester onTest={handleTest} />}

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300/90">
          {error}
        </p>
      )}

      {tested && (
        <button
          onClick={handleMigrate}
          disabled={migrating}
          className={`${onboardingPrimaryButtonClass} mt-2 self-center`}
        >
          {migrating ? "Setting up database..." : "Continue"}
        </button>
      )}
    </div>
  );
}

function SupabaseForm({ setupToken, onContinue }: { setupToken: string; onContinue: () => void }) {
  const [connectionString, setConnectionString] = useState("");
  const [tested, setTested] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    const res = await fetch("/api/setup/test-connection", {
      method: "POST",
      headers: setupHeaders(setupToken),
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
        headers: setupHeaders(setupToken),
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
    <div className="flex w-full flex-col gap-4">
      <InputField
        label="PostgreSQL connection string"
        value={connectionString}
        onChange={setConnectionString}
        placeholder="postgresql://postgres.[ref]:[pass]@[host]:5432/postgres"
        note="Find this in your Supabase dashboard under Project Settings -> Database -> Connection string (URI)"
      />

      <a
        href="https://supabase.com/dashboard"
        target="_blank"
        rel="noopener noreferrer"
        className={`${onboardingTextButtonClass} self-start text-xs`}
      >
        Open Supabase Dashboard -&gt;
      </a>

      {connectionString && <ConnectionTester onTest={handleTest} />}

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300/90">
          {error}
        </p>
      )}

      {tested && (
        <button
          onClick={handleMigrate}
          disabled={migrating}
          className={`${onboardingPrimaryButtonClass} mt-2 self-center`}
        >
          {migrating ? "Setting up database..." : "Continue"}
        </button>
      )}
    </div>
  );
}
