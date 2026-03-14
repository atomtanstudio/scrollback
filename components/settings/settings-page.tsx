"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { DatabaseSection } from "./sections/database-section";
import { ExtensionSection } from "./sections/extension-section";
import { SearchSection } from "./sections/search-section";
import { EmbeddingsSection } from "./sections/embeddings-section";
import { DataSection } from "./sections/data-section";
import { XApiSection } from "./sections/xapi-section";

interface SettingsData {
  configured: boolean;
  database?: { type: string; url: string };
  embeddings?: { provider: string; apiKey: string | null; hasKey: boolean };
  extension?: { pairingToken: string | null };
  xapi?: { hasBearerToken: boolean };
  search?: { keywordWeight: number; semanticWeight: number };
  r2?: { configured: boolean; mediaWithStored: number; mediaWithoutStored: number };
}

interface SettingsPageProps {
  stats: { total: number; tweets: number; threads: number; articles: number; art: number };
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
    <div>
      <div className="mb-4">
        <h2 className="font-heading text-lg font-bold tracking-tight text-[#f0f0f5]">
          {title}
        </h2>
        <p className="text-xs text-[#8888aa] mt-0.5">{description}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function SettingsPage({ stats }: SettingsPageProps) {
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
    <div className="relative z-10 max-w-[960px] mx-auto px-6">
      <Header captureCount={stats.total} />

      <div className="py-8">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-[#f0f0f5] mb-2">
          Settings
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] text-sm mb-10">
          Configure your FeedSilo instance
        </p>

        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded-[14px] bg-[#1a1a24] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            <SectionGroup
              title="Capture"
              description="Browser extension and content ingestion"
            >
              <ExtensionSection settings={settings} onRefresh={fetchSettings} />
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
