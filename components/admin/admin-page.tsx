"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { AdminItem } from "@/components/admin/columns";
import { DataTable } from "@/components/admin/data-table";
import { BulkActionsBar } from "@/components/admin/bulk-actions-bar";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { ItemEditDialog } from "@/components/admin/item-edit-dialog";
import { ManualCaptureDialog } from "@/components/admin/manual-capture-dialog";
import { Header } from "@/components/header";

interface AdminPageProps {
  isAuthed: boolean;
  captureCount: number;
}

export function AdminPage({ isAuthed, captureCount }: AdminPageProps) {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [editItem, setEditItem] = useState<AdminItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminItem | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (typeFilter !== "all") params.set("type", typeFilter);

      const res = await fetch(`/api/admin/items?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();
      setItems(data.items);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error("Failed to fetch admin items:", err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Reset type filter also resets page
  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    setPage(1);
  };

  // Handlers
  const handleEdit = (item: AdminItem) => {
    setEditItem(item);
    setEditOpen(true);
  };

  const handleDelete = (item: AdminItem) => {
    setDeleteTarget(item);
    setDeleteOpen(true);
  };

  const handleReprocess = async (item: AdminItem) => {
    try {
      await fetch(`/api/admin/items/${item.id}/reprocess`, { method: "POST" });
      fetchItems();
    } catch (err) {
      console.error("Failed to reprocess:", err);
    }
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      try {
        await fetch(`/api/admin/items/${deleteTarget.id}`, {
          method: "DELETE",
        });
        setDeleteOpen(false);
        setDeleteTarget(null);
        fetchItems();
      } catch (err) {
        console.error("Failed to delete:", err);
      }
    }
  };

  const handleBulkDelete = () => {
    setBulkDeleteOpen(true);
  };

  const confirmBulkDelete = async () => {
    try {
      await fetch("/api/admin/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      fetchItems();
    } catch (err) {
      console.error("Failed to bulk delete:", err);
    }
  };

  const handleBulkReprocess = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/admin/items/${id}/reprocess`, { method: "POST" })
        )
      );
      setSelectedIds(new Set());
      fetchItems();
    } catch (err) {
      console.error("Failed to bulk reprocess:", err);
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px] pb-16">
        <Header captureCount={captureCount} isAuthed={isAuthed} currentPath="/admin" />

        <section className="overflow-hidden rounded-[32px] border border-[#d6c9b21a] bg-[linear-gradient(180deg,rgba(24,29,37,0.96),rgba(14,18,24,0.98))] px-5 py-6 shadow-[0_34px_90px_rgba(2,6,12,0.32)] sm:px-6 sm:py-7 lg:px-7">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_340px]">
            <div className="rounded-[28px] border border-[#d6c9b214] bg-[#ffffff08] p-6 sm:p-8">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">Admin</p>
              <h1 className="mt-3 max-w-[10ch] font-heading text-[clamp(3rem,5vw,4.5rem)] font-semibold leading-[0.94] tracking-[-0.07em] text-[#f2ede5]">
                Operate the archive without leaving the system.
              </h1>
              <p className="mt-5 max-w-[58ch] text-[16px] leading-8 text-[#b4ab9d]">
                Search, inspect, repair, and recapture items from one dense surface. The workflow stays tabular, but the shell matches the rest of FeedSilo now.
              </p>
            </div>

            <div className="grid gap-5">
              <div className="rounded-[28px] border border-[#d6c9b214] bg-[radial-gradient(circle_at_top_left,rgba(184,148,98,0.14),transparent_30%),rgba(255,255,255,0.05)] p-6">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">Current page</p>
                <div className="mt-4 font-heading text-[clamp(3.6rem,6vw,5rem)] leading-none tracking-[-0.08em] text-[#f2ede5]">
                  {page}
                </div>
                <p className="mt-4 text-[15px] leading-7 text-[#b4ab9d]">
                  {loading ? "Loading items..." : `${items.length} items loaded`} with {selectedCount} selected.
                </p>
              </div>

              <div className="rounded-[28px] border border-[#d6c9b214] bg-[#ffffff08] p-6">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">Actions</p>
                <Button
                  onClick={() => setManualOpen(true)}
                  className="mt-4 h-11 rounded-[14px] bg-[var(--accent-article)] px-5 font-heading font-semibold text-[#090c11] hover:brightness-110"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
                <p className="mt-4 text-[15px] leading-7 text-[#b4ab9d]">
                  Use manual capture for backfills, corrected recaptures, or one-off entries that never came through the extension.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-[#d6c9b214] bg-[#12161d]/70 p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-4 border-b border-[#d6c9b214] pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#a49b8b]">Item operations</p>
                <h2 className="mt-2 font-heading text-[1.85rem] font-semibold tracking-[-0.04em] text-[#f2ede5]">
                  Search, filter, and repair captured items
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#8a8174]">
                <span>{captureCount.toLocaleString()} total captures</span>
                <span>{totalPages} pages</span>
              </div>
            </div>

            <div className="mb-6 flex flex-col gap-4 lg:flex-row">
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 max-w-xl rounded-[14px] border-[#d6c9b214] bg-[#0f141b] px-4 text-sm text-[#f2ede5] placeholder:text-[#6f695f] focus-visible:ring-[#b89462]"
              />
              <Select value={typeFilter} onValueChange={handleTypeChange}>
                <SelectTrigger className="h-12 w-full rounded-[14px] border-[#d6c9b214] bg-[#0f141b] text-sm text-[#f2ede5] lg:w-[220px]">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent className="border-[#d6c9b214] bg-[#171b22] text-[#f2ede5]">
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="tweet">Tweet</SelectItem>
                  <SelectItem value="thread">Thread</SelectItem>
                  <SelectItem value="article">Article</SelectItem>
                  <SelectItem value="image_prompt">Image Prompt</SelectItem>
                  <SelectItem value="video_prompt">Video Prompt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05] py-24">
                <div className="text-[#a49b8b]">Loading items...</div>
              </div>
            ) : (
              <DataTable
                items={items}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReprocess={handleReprocess}
              />
            )}

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-[12px] border-[#d6c9b214] bg-[#ffffff05] text-[#f2ede5] hover:border-[#d6c9b233] hover:bg-[#ffffff08]"
                >
                  Previous
                </Button>
                <span className="text-sm text-[#8a8174]">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-[12px] border-[#d6c9b214] bg-[#ffffff05] text-[#f2ede5] hover:border-[#d6c9b233] hover:bg-[#ffffff08]"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>

      <BulkActionsBar
        selectedCount={selectedCount}
        onDelete={handleBulkDelete}
        onReprocess={handleBulkReprocess}
        onClear={() => setSelectedIds(new Set())}
      />

      {/* Delete Confirmation (single) */}
      <DeleteConfirmDialog
        open={deleteOpen}
        count={1}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
      />

      {/* Bulk Delete Confirmation */}
      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        count={selectedIds.size}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />

      {/* Edit Dialog */}
      <ItemEditDialog
        item={editItem}
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditItem(null);
        }}
        onSaved={fetchItems}
      />

      {/* Manual Capture Dialog */}
      <ManualCaptureDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={fetchItems}
      />
    </div>
  );
}
