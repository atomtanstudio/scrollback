"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { DatabaseSection } from "./sections/database-section";
import { ExtensionSection } from "./sections/extension-section";
import { SearchSection } from "./sections/search-section";
import { EmbeddingsSection } from "./sections/embeddings-section";
import { DataSection } from "./sections/data-section";

interface SettingsData {
  configured: boolean;
  database?: { type: string; url: string };
  embeddings?: { provider: string; apiKey: string | null; hasKey: boolean };
  extension?: { pairingToken: string | null };
  search?: { keywordWeight: number; semanticWeight: number };
  r2?: { configured: boolean; mediaWithStored: number; mediaWithoutStored: number };
}

interface SettingsPageProps {
  stats: { total: number; tweets: number; threads: number; articles: number; art: number };
}

export function SettingsPage({ stats }: SettingsPageProps) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data);
    } catch {
      // Silently fail
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
        <p className="text-[hsl(var(--muted-foreground))] text-sm mb-8">
          Configure your FeedSilo instance
        </p>

        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded-[14px] bg-[#1a1a24] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <DatabaseSection settings={settings} onRefresh={fetchSettings} />
            <ExtensionSection settings={settings} onRefresh={fetchSettings} />
            <SearchSection settings={settings} onRefresh={fetchSettings} />
            <EmbeddingsSection settings={settings} onRefresh={fetchSettings} />
            <DataSection stats={stats} settings={settings} />
          </div>
        )}
      </div>
    </div>
  );
}
