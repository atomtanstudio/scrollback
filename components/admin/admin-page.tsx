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

export function AdminPage() {
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

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-heading text-3xl font-semibold text-[#f0f0f5]">
            Admin
          </h1>
          <Button
            onClick={() => setManualOpen(true)}
            className="rounded-[14px] bg-[var(--accent-thread)] text-[#0a0a0f] font-heading font-semibold hover:bg-[var(--accent-thread)]/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 max-w-md rounded-[10px] border-[#ffffff12] bg-[#0a0a0f] px-4 text-sm text-[#f0f0f5] placeholder:text-[#555566]"
          />
          <Select value={typeFilter} onValueChange={handleTypeChange}>
            <SelectTrigger className="h-10 w-[180px] rounded-[10px] border-[#ffffff12] bg-[#0a0a0f] text-sm text-[#f0f0f5]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent className="border-[#ffffff12] bg-[#111118]">
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="tweet">Tweet</SelectItem>
              <SelectItem value="thread">Thread</SelectItem>
              <SelectItem value="article">Article</SelectItem>
              <SelectItem value="image_prompt">Image Prompt</SelectItem>
              <SelectItem value="video_prompt">Video Prompt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-[#8888aa]">Loading...</div>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-[10px] border-[#ffffff12] bg-[#0a0a0f] text-[#f0f0f5]"
            >
              Previous
            </Button>
            <span className="text-sm text-[#8888aa]">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-[10px] border-[#ffffff12] bg-[#0a0a0f] text-[#f0f0f5]"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
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
