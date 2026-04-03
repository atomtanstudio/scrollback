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

interface UserOption {
  id: string;
  email: string;
  role: string;
}

interface AdminPageProps {
  isAuthed: boolean;
  isAdmin?: boolean;
  captureCount: number;
}

export function AdminPage({ isAuthed, isAdmin = true, captureCount }: AdminPageProps) {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // User picker
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Dialog state
  const [editItem, setEditItem] = useState<AdminItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminItem | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Load users list
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/users")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => {
        const userList: UserOption[] = data.users || [];
        setUsers(userList);
        const admin = userList.find((u) => u.role === "admin");
        if (admin) setSelectedUserId(admin.id);
      })
      .catch(() => {});
  }, [isAdmin]);

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
      if (platformFilter !== "all") params.set("platform", platformFilter);
      if (mediaFilter !== "all") params.set("hasMedia", mediaFilter);
      if (selectedUserId) params.set("userId", selectedUserId);

      const res = await fetch(`/api/admin/items?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error("Failed to fetch admin items:", err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter, platformFilter, mediaFilter, selectedUserId]);

  useEffect(() => {
    if (selectedUserId) fetchItems();
  }, [fetchItems, selectedUserId]);

  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

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
      const params = selectedUserId ? `?userId=${selectedUserId}` : "";
      await fetch(`/api/admin/items/${item.id}/reprocess${params}`, { method: "POST" });
      fetchItems();
    } catch (err) {
      console.error("Failed to reprocess:", err);
    }
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      try {
        const params = selectedUserId ? `?userId=${selectedUserId}` : "";
        await fetch(`/api/admin/items/${deleteTarget.id}${params}`, {
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
        Array.from(selectedIds).map((id) => {
          const params = selectedUserId ? `?userId=${selectedUserId}` : "";
          return fetch(`/api/admin/items/${id}/reprocess${params}`, { method: "POST" });
        }
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
      <div className="mx-auto max-w-6xl pb-16">
        <Header captureCount={captureCount} isAuthed={isAuthed} isAdmin={isAdmin} currentPath="/admin" />

        {/* Compact toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-[-0.04em] text-[#f2ede5]">
              Items
            </h1>
            <span className="text-sm text-[#8a8174]">
              {total.toLocaleString()} {typeFilter !== "all" || platformFilter !== "all" || mediaFilter !== "all" || debouncedSearch ? "matching" : "total"}
            </span>
          </div>
          {isAdmin && (
            <Button
              onClick={() => setManualOpen(true)}
              size="sm"
              className="h-9 rounded-[12px] bg-[var(--accent-article)] px-4 text-sm font-medium text-[#090c11] hover:brightness-110"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Item
            </Button>
          )}
        </div>

        {/* User picker + filters */}
        <div className="mb-4 flex flex-col gap-3">
          {isAdmin && users.length > 1 && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-[#a49b8b]">User</label>
              <select
                value={selectedUserId}
                onChange={(e) => { setSelectedUserId(e.target.value); setPage(1); }}
                className="h-9 rounded-[12px] border border-[#d6c9b214] bg-[#0f141b] px-3 text-sm text-[#f2ede5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Input
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 flex-1 rounded-[12px] border-[#d6c9b214] bg-[#0f141b] px-4 text-sm text-[#f2ede5] placeholder:text-[#6f695f] focus-visible:ring-[#b89462] sm:max-w-xs"
            />
            <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)}>
              <SelectTrigger className="h-10 w-full rounded-[12px] border-[#d6c9b214] bg-[#0f141b] text-sm text-[#f2ede5] sm:w-[160px]">
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
            <Select value={platformFilter} onValueChange={handleFilterChange(setPlatformFilter)}>
              <SelectTrigger className="h-10 w-full rounded-[12px] border-[#d6c9b214] bg-[#0f141b] text-sm text-[#f2ede5] sm:w-[160px]">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent className="border-[#d6c9b214] bg-[#171b22] text-[#f2ede5]">
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="x">X / Twitter</SelectItem>
                <SelectItem value="rss">RSS</SelectItem>
                <SelectItem value="web">Web</SelectItem>
              </SelectContent>
            </Select>
            <Select value={mediaFilter} onValueChange={handleFilterChange(setMediaFilter)}>
              <SelectTrigger className="h-10 w-full rounded-[12px] border-[#d6c9b214] bg-[#0f141b] text-sm text-[#f2ede5] sm:w-[160px]">
                <SelectValue placeholder="Any media" />
              </SelectTrigger>
              <SelectContent className="border-[#d6c9b214] bg-[#171b22] text-[#f2ede5]">
                <SelectItem value="all">Any media</SelectItem>
                <SelectItem value="yes">Has media</SelectItem>
                <SelectItem value="no">No media</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center rounded-[16px] border border-[#d6c9b214] bg-[#ffffff05] py-20">
            <span className="text-sm text-[#a49b8b]">Loading items...</span>
          </div>
        ) : (
          <DataTable
            items={items}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReprocess={handleReprocess}
            isAdmin={isAdmin}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-[10px] border-[#d6c9b214] bg-[#ffffff05] text-[#f2ede5] hover:border-[#d6c9b233] hover:bg-[#ffffff08]"
            >
              Previous
            </Button>
            <span className="text-sm text-[#8a8174]">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-[10px] border-[#d6c9b214] bg-[#ffffff05] text-[#f2ede5] hover:border-[#d6c9b233] hover:bg-[#ffffff08]"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {isAdmin && (
        <BulkActionsBar
          selectedCount={selectedCount}
          onDelete={handleBulkDelete}
          onReprocess={handleBulkReprocess}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {isAdmin && (
        <>
          <DeleteConfirmDialog
            open={deleteOpen}
            count={1}
            onConfirm={confirmDelete}
            onCancel={() => {
              setDeleteOpen(false);
              setDeleteTarget(null);
            }}
          />
          <DeleteConfirmDialog
            open={bulkDeleteOpen}
            count={selectedIds.size}
            onConfirm={confirmBulkDelete}
            onCancel={() => setBulkDeleteOpen(false)}
          />
          <ItemEditDialog
            item={editItem}
            open={editOpen}
            onClose={() => {
              setEditOpen(false);
              setEditItem(null);
            }}
            onSaved={fetchItems}
            userId={selectedUserId}
          />
          <ManualCaptureDialog
            open={manualOpen}
            onClose={() => setManualOpen(false)}
            onCreated={fetchItems}
            userId={selectedUserId}
          />
        </>
      )}
    </div>
  );
}
