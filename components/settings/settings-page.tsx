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
import { AccountSection } from "./sections/account-section";
import { LocalMediaSection } from "./sections/local-media-section";
import { UsersSection } from "./sections/users-section";

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
  stats: { total: number; tweets: number; threads: number; articles: number; rss: number; art: number };
  isAuthed: boolean;
  isAdmin?: boolean;
  isReadOnly?: boolean;
}

export function SettingsPage({ stats, isAuthed, isAdmin = true, isReadOnly = false }: SettingsPageProps) {
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
    <div className="min-h-screen px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl pb-16">
        <Header captureCount={stats.total} isAuthed={isAuthed} currentPath="/settings" />

        {/* Compact toolbar */}
        <div className="mb-6 flex items-baseline gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-[-0.04em] text-[#f2ede5]">
            Settings
          </h1>
          <span className="text-sm text-[#8a8174]">
            {stats.total.toLocaleString()} items captured
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-[16px] border border-[#d6c9b214] bg-[#ffffff08]" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {isReadOnly && (
              <div className="rounded-[16px] border border-[#b8946233] bg-[#b894621a] px-5 py-3 text-sm text-[#e7d5be]">
                You&apos;re viewing settings in read-only mode. Changes are disabled for demo accounts.
              </div>
            )}

            {isAdmin && (
              <>
                <UsersSection />
                <ExtensionSection settings={settings} onRefresh={fetchSettings} />
              </>
            )}

            <div className={isReadOnly ? "pointer-events-none opacity-60" : ""}>
              <div className="flex flex-col gap-4">
                <RssSection settings={settings} onRefresh={fetchSettings} isAdmin={isAdmin} />

                {isAdmin && (
                  <>
                    <XApiSection settings={settings} onRefresh={fetchSettings} />
                    <EmbeddingsSection settings={settings} onRefresh={fetchSettings} />
                    <DatabaseSection settings={settings} onRefresh={fetchSettings} />
                    <LocalMediaSection settings={settings} onRefresh={fetchSettings} />
                    <SearchSection settings={settings} onRefresh={fetchSettings} />
                  </>
                )}

                <AccountSection />

                <DataSection stats={stats} settings={settings} isAdmin={isAdmin} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
