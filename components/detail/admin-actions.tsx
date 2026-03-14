"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, RefreshCw } from "lucide-react";
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
  };
}

const btnClass =
  "flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium bg-[#111118] border border-[#ffffff0a] text-[#8888aa] hover:text-[#f0f0f5] hover:border-[#ffffff24] transition-colors cursor-pointer";

export function AdminActions({ item }: AdminActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessStatus, setReprocessStatus] = useState<string | null>(null);
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

  const clearStatusAfter = (ms: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setReprocessStatus(null);
      timeoutRef.current = null;
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

  return (
    <>
      <div className="bg-[var(--surface)] border border-[hsl(var(--border))] rounded-[14px] p-4 px-5">
        <p
          className="font-heading font-semibold text-[13px] text-[#8888aa] mb-3"
          style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
        >
          Admin
        </p>
        <div className="flex gap-2">
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
