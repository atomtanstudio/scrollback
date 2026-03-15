"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { DatabaseSection } from "./sections/database-section";
import { ExtensionSection } from "./sections/extension-section";
import { SearchSection } from "./sections/search-section";
import { EmbeddingsSection } from "./sections/embeddings-section";
import { DataSection } from "./sections/data-section";
import { XApiSection } from "./sections/xapi-section";
import { RssSection } from "./sections/rss-section";

interface SettingsData {
  configured: boolean;
  database?: { type: string; url: string };
  embeddings?: { provider: string; apiKey: string | null; hasKey: boolean };
  extension?: { hasPairingToken: boolean; managedByEnv: boolean };
  xapi?: { hasBearerToken: boolean };
  search?: { keywordWeight: number; semanticWeight: number };
  r2?: { configured: boolean; mediaWithStored: number; mediaWithoutStored: number };
}

interface SettingsPageProps {
  stats: { total: number; tweets: number; threads: number; articles: number; art: number };
  isAuthed: boolean;
}

function SectionGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#d6c9b214] bg-[#ffffff08] p-6 sm:p-7">
      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">{title}</p>
        <h2 className="mt-2 font-heading text-[1.65rem] font-semibold tracking-[-0.05em] text-[#f2ede5]">
          {title}
        </h2>
        <p className="mt-2 max-w-[56ch] text-sm leading-6 text-[#b4ab9d]">{description}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function SettingsPage({ stats, isAuthed }: SettingsPageProps) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        console.error("Settings fetch failed:", res.status, res.statusText);
        return;
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        console.error("Settings returned non-JSON:", contentType);
        return;
      }
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error("Settings fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <div className="relative z-10 mx-auto max-w-[1440px] px-4 pb-16 sm:px-6 lg:px-8">
      <Header captureCount={stats.total} isAuthed={isAuthed} currentPath="/settings" />

      <div className="overflow-hidden rounded-[32px] border border-[#d6c9b21a] bg-[linear-gradient(180deg,rgba(24,29,37,0.96),rgba(14,18,24,0.98))] px-5 py-6 shadow-[0_34px_90px_rgba(2,6,12,0.32)] sm:px-6 sm:py-7 lg:px-7">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_340px]">
          <div className="rounded-[28px] border border-[#d6c9b214] bg-[#ffffff08] p-6 sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">Settings</p>
            <h1 className="mt-3 max-w-[10ch] font-heading text-[clamp(3rem,5vw,4.5rem)] font-semibold leading-[0.94] tracking-[-0.07em] text-[#f2ede5]">
              Configure the system behind your archive.
            </h1>
            <p className="mt-5 max-w-[58ch] text-[16px] leading-8 text-[#b4ab9d]">
              Database, search, extension pairing, X API access, embeddings, and data operations live here.
              The structure stays operational, but the shell now matches the collector feel of the public app.
            </p>
          </div>

          <div className="grid gap-5">
            <div className="rounded-[28px] border border-[#d6c9b214] bg-[radial-gradient(circle_at_top_left,rgba(184,148,98,0.14),transparent_30%),rgba(255,255,255,0.05)] p-6">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">Library size</p>
              <div className="mt-4 font-heading text-[clamp(4rem,7vw,5.4rem)] leading-none tracking-[-0.08em] text-[#f2ede5]">
                {stats.total.toLocaleString()}
              </div>
              <p className="mt-4 text-[15px] leading-7 text-[#b4ab9d]">
                {stats.tweets.toLocaleString()} tweets, {stats.threads.toLocaleString()} threads, {stats.articles.toLocaleString()} articles, and {stats.art.toLocaleString()} art items.
              </p>
            </div>

            <div className="rounded-[28px] border border-[#d6c9b214] bg-[#ffffff08] p-6">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">System posture</p>
              <p className="mt-4 text-[15px] leading-7 text-[#b4ab9d]">
                Infrastructure and integrations are grouped by actual workflow instead of feeling like a generic admin checklist.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 flex flex-col gap-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-[28px] border border-[#d6c9b214] bg-[#ffffff08]" />
            ))}
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            <SectionGroup
              title="Capture"
              description="Browser extension and content ingestion"
            >
              <ExtensionSection settings={settings} onRefresh={fetchSettings} />
            </SectionGroup>

            <SectionGroup
              title="Sources"
              description="Bring trusted feeds into the same archive"
            >
              <RssSection settings={settings} onRefresh={fetchSettings} />
            </SectionGroup>

            <SectionGroup
              title="Integrations"
              description="External API connections"
            >
              <XApiSection settings={settings} onRefresh={fetchSettings} />
              <EmbeddingsSection settings={settings} onRefresh={fetchSettings} />
            </SectionGroup>

            <SectionGroup
              title="Infrastructure"
              description="Database, search, and storage"
            >
              <DatabaseSection settings={settings} onRefresh={fetchSettings} />
              <SearchSection settings={settings} onRefresh={fetchSettings} />
            </SectionGroup>

            <SectionGroup
              title="Data"
              description="Stats, export, and management"
            >
              <DataSection stats={stats} settings={settings} />
            </SectionGroup>
          </div>
        )}
      </div>
    </div>
  );
}
