"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, RefreshCw, HardDriveDownload } from "lucide-react";
import { ItemEditDialog } from "@/components/admin/item-edit-dialog";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import type { AdminItem } from "@/components/admin/columns";

interface AdminActionsProps {
  item: {
    id: string;
    source_type: string;
    title: string | null;
    body_text: string | null;
    author_handle: string | null;
    author_display_name: string | null;
    original_url: string | null;
    posted_at: Date | string | null;
    media_items?: Array<{
      id: string;
      stored_path: string | null;
    }>;
  };
}

const btnClass =
  "flex cursor-pointer items-center gap-1.5 rounded-[12px] border border-[#d6c9b214] bg-[#ffffff05] px-3 py-2 text-xs font-medium text-[#a49b8b] transition-colors hover:border-[#d6c9b233] hover:text-[#f2ede5]";

export function AdminActions({ item }: AdminActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessStatus, setReprocessStatus] = useState<string | null>(null);
  const [backfillingMedia, setBackfillingMedia] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const adminItem: AdminItem = {
    id: item.id,
    external_id: "",
    source_type: item.source_type,
    title: item.title,
    body_text: item.body_text,
    body_preview: "",
    author_handle: item.author_handle,
    author_display_name: item.author_display_name,
    author_avatar_url: null,
    original_url: item.original_url,
    posted_at: item.posted_at instanceof Date ? item.posted_at.toISOString() : item.posted_at,
    created_at: "",
    thumbnail: null,
  };
  const mediaCount = item.media_items?.length ?? 0;

  const clearStatusAfter = (ms: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setReprocessStatus(null);
      timeoutRef.current = null;
    }, ms);
  };

  const clearMediaStatusAfter = (ms: number) => {
    setTimeout(() => {
      setMediaStatus(null);
    }, ms);
  };

  const handleDelete = async () => {
    try {
      await fetch(`/api/admin/items/${item.id}`, { method: "DELETE" });
      setDeleteOpen(false);
      router.push("/");
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleReprocess = async () => {
    setReprocessing(true);
    setReprocessStatus(null);
    try {
      const res = await fetch(`/api/admin/items/${item.id}/reprocess`, {
        method: "POST",
      });
      if (res.ok) {
        setReprocessStatus("Queued");
        clearStatusAfter(2000);
      } else {
        setReprocessStatus("Failed");
        clearStatusAfter(3000);
      }
    } catch (err) {
      console.error("Failed to reprocess:", err);
      setReprocessStatus("Failed");
      clearStatusAfter(3000);
    } finally {
      setReprocessing(false);
    }
  };

  const handleMediaBackfill = async () => {
    setBackfillingMedia(true);
    setMediaStatus(null);
    try {
      const res = await fetch(`/api/admin/items/${item.id}/media-backfill`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMediaStatus(data.message || "Done");
        router.refresh();
        clearMediaStatusAfter(3000);
      } else {
        setMediaStatus(data.error || "Failed");
        clearMediaStatusAfter(4000);
      }
    } catch (err) {
      console.error("Failed to backfill media:", err);
      setMediaStatus("Failed");
      clearMediaStatusAfter(4000);
    } finally {
      setBackfillingMedia(false);
    }
  };

  return (
    <>
      <div className="rounded-[24px] border border-[#d6c9b214] bg-[#ffffff08] p-5">
        <p
          className="mb-3 font-heading text-[13px] font-semibold text-[#a49b8b]"
          style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          Admin
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={btnClass} onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button className={btnClass} onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <button
            className={btnClass}
            onClick={handleReprocess}
            disabled={reprocessing}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${reprocessing ? "animate-spin" : ""}`}
            />
            {reprocessStatus || "Reprocess"}
          </button>
          <button
            className={btnClass}
            onClick={handleMediaBackfill}
            disabled={backfillingMedia || mediaCount === 0}
            title={mediaCount === 0 ? "This item has no media" : undefined}
          >
            <HardDriveDownload
              className={`h-3.5 w-3.5 ${backfillingMedia ? "animate-pulse" : ""}`}
            />
            {mediaStatus || "Backfill Media"}
          </button>
        </div>
      </div>

      <ItemEditDialog
        item={editOpen ? adminItem : null}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          router.refresh();
        }}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        count={1}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}
