"use client";

import { useState, useEffect } from "react";
import { ProgressBar } from "@/components/shared/progress-bar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface LocalMediaSectionProps { settings: any; onRefresh: () => void }

export function LocalMediaSection({ settings, onRefresh }: LocalMediaSectionProps) {
  const local = settings?.localMedia;
  const r2Configured = settings?.r2?.configured;

  const [path, setPath] = useState<string>(local?.path || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPath(local?.path || "");
  }, [local?.path]);

  const handleSave = async () => {
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localMedia: { path: path.trim() || undefined } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || "Failed to save");
      } else {
        setSaved(true);
        onRefresh();
      }
    } catch {
      setSaveError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  const configured = local?.configured;

  return (
    <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05] p-6">
      <div className="mb-5 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,rgba(184,148,98,0.92),rgba(110,152,160,0.92))]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0a0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-heading text-[15px] font-semibold text-[#f2ede5]">Local Media Storage</h3>
            <p className="text-xs text-[#a49b8b]">
              {r2Configured ? "Alternative to R2 — save media to a local directory" : "Save captured media to a local directory"}
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          configured
            ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
            : "border border-[#d6c9b214] bg-[#ffffff05] text-[#8a8174]"
        }`}>
          {configured ? "Active" : "Not set"}
        </span>
      </div>

      {!configured && !path && (
        <p className="mb-4 text-xs text-[#a49b8b]">
          Without R2 or a local directory, captured media URLs are stored as external links which may expire over time.
          Set a directory path below to download and preserve all media locally.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#a49b8b]">Directory path</label>
          <input
            type="text"
            value={path}
            onChange={e => { setPath(e.target.value); setSaved(false); }}
            placeholder="/home/user/feedsilo-media"
            className="h-9 rounded-[12px] border border-[#d6c9b214] bg-[#0f141b] px-3 text-sm text-[#f2ede5] font-mono placeholder:text-[#4a4540] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
          />
          <p className="text-[10px] text-[#8a8174]">
            Absolute or relative path. The directory will be created if it does not exist. You can also set <code className="rounded bg-[#0f141b] px-1 py-0.5">LOCAL_MEDIA_PATH</code> as an environment variable.
          </p>
        </div>

        {saveError && <p className="text-xs text-red-400">{saveError}</p>}
        {saved && <p className="text-xs text-emerald-400">Path saved — new captures will download media to this directory.</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 rounded-[12px] bg-[var(--accent-article)] px-4 text-sm font-medium font-heading text-[#090c11] transition-all duration-200 hover:brightness-110 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving..." : "Save Path"}
          </button>
          {configured && (
            <button
              onClick={() => { setPath(""); setSaved(false); }}
              className="h-9 rounded-[12px] border border-[#d6c9b214] bg-[#ffffff05] px-4 text-sm font-medium text-[#a49b8b] transition-all duration-200 hover:border-[#d6c9b233] cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {configured && (
          <div className="mt-1 flex flex-col gap-2 border-t border-[#d6c9b214] pt-4">
            <h4 className="text-sm font-medium text-[#f2ede5]">Backfill existing items</h4>
            <p className="text-xs text-[#a49b8b]">
              Download media for items captured before local storage was configured.
            </p>
            <ProgressBar
              endpoint="/api/media/local-backfill"
              buttonLabel="Download Media Locally"
            />
          </div>
        )}
      </div>
    </div>
  );
}
