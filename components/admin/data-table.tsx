"use client";

import { useCallback, useRef } from "react";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  RefreshCw,
  ExternalLink,
  FileText,
} from "lucide-react";
import type { AdminItem } from "@/components/admin/columns";

const TYPE_COLORS: Record<string, string> = {
  tweet: "bg-[#22d3ee]/15 text-[#22d3ee] border-[#22d3ee]/30",
  thread: "bg-[#a78bfa]/15 text-[#a78bfa] border-[#a78bfa]/30",
  article: "bg-[#fb923c]/15 text-[#fb923c] border-[#fb923c]/30",
  image_prompt: "bg-[#ec4899]/15 text-[#ec4899] border-[#ec4899]/30",
  video_prompt: "bg-[#ec4899]/15 text-[#ec4899] border-[#ec4899]/30",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTypeName(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface DataTableProps {
  items: AdminItem[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onEdit: (item: AdminItem) => void;
  onDelete: (item: AdminItem) => void;
  onReprocess: (item: AdminItem) => void;
}

export function DataTable({
  items,
  selectedIds,
  onSelectionChange,
  onEdit,
  onDelete,
  onReprocess,
}: DataTableProps) {
  const lastClickedIndex = useRef<number | null>(null);

  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
  const someSelected = items.some((i) => selectedIds.has(i.id)) && !allSelected;

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(items.map((i) => i.id)));
    }
  }, [allSelected, items, onSelectionChange]);

  const handleRowSelect = useCallback(
    (index: number, event: React.MouseEvent) => {
      const item = items[index];
      const next = new Set(selectedIds);

      if (event.shiftKey && lastClickedIndex.current !== null) {
        const start = Math.min(lastClickedIndex.current, index);
        const end = Math.max(lastClickedIndex.current, index);
        for (let i = start; i <= end; i++) {
          next.add(items[i].id);
        }
      } else {
        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
      }

      lastClickedIndex.current = index;
      onSelectionChange(next);
    },
    [items, selectedIds, onSelectionChange]
  );

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[14px] border border-[#ffffff0a] bg-[var(--surface)] py-20">
        <FileText className="mb-4 h-10 w-10 text-[#555566]" />
        <p className="text-[#8888aa]">No items found</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-[#ffffff0a] bg-[var(--surface)]">
      <Table>
        <TableHeader>
          <TableRow className="border-[#ffffff0a] hover:bg-transparent">
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    (el as unknown as HTMLButtonElement).dataset.state =
                      someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked";
                  }
                }}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead className="w-[50px] text-[#8888aa]">Thumb</TableHead>
            <TableHead className="text-[#8888aa]">Title / Preview</TableHead>
            <TableHead className="text-[#8888aa]">Author</TableHead>
            <TableHead className="text-[#8888aa]">Type</TableHead>
            <TableHead className="text-[#8888aa]">Date</TableHead>
            <TableHead className="w-[50px] text-[#8888aa]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow
              key={item.id}
              className="border-[#ffffff0a] hover:bg-[#ffffff06]"
              data-state={selectedIds.has(item.id) ? "selected" : undefined}
            >
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() =>
                    handleRowSelect(index, { shiftKey: false } as React.MouseEvent)
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRowSelect(index, e);
                  }}
                />
              </TableCell>
              <TableCell>
                {item.thumbnail ? (
                  <Image
                    src={item.thumbnail}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0a0a0f]">
                    <FileText className="h-4 w-4 text-[#555566]" />
                  </div>
                )}
              </TableCell>
              <TableCell className="max-w-[300px]">
                <div className="truncate font-medium text-[#f0f0f5]">
                  {item.title || "Untitled"}
                </div>
                <div className="truncate text-xs text-[#8888aa]">
                  {item.body_preview}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm text-[#f0f0f5]">
                  {item.author_display_name || "—"}
                </div>
                {item.author_handle && (
                  <div className="text-xs text-[#8888aa]">
                    @{item.author_handle}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={TYPE_COLORS[item.source_type] || "text-[#8888aa]"}
                >
                  {formatTypeName(item.source_type)}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-[#8888aa]">
                {formatDate(item.posted_at)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-[#8888aa] hover:text-[#f0f0f5]"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="border-[#ffffff12] bg-[#111118]"
                  >
                    <DropdownMenuItem
                      onClick={() => onEdit(item)}
                      className="text-[#f0f0f5] focus:bg-[#ffffff0a] focus:text-[#f0f0f5]"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(item)}
                      className="text-red-400 focus:bg-[#ffffff0a] focus:text-red-400"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onReprocess(item)}
                      className="text-[#f0f0f5] focus:bg-[#ffffff0a] focus:text-[#f0f0f5]"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reprocess
                    </DropdownMenuItem>
                    {item.original_url && (
                      <DropdownMenuItem
                        asChild
                        className="text-[#f0f0f5] focus:bg-[#ffffff0a] focus:text-[#f0f0f5]"
                      >
                        <a
                          href={item.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View Original
                        </a>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
