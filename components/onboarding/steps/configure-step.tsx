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
