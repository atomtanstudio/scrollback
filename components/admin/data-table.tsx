"use client";

import { useCallback, useRef } from "react";
import { getMediaDisplayUrl } from "@/lib/media-url";
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
  tweet: "border-[color:rgba(110,152,160,0.22)] bg-[color:rgba(110,152,160,0.12)] text-[var(--accent-tweet)]",
  thread: "border-[color:rgba(140,127,159,0.22)] bg-[color:rgba(140,127,159,0.12)] text-[var(--accent-thread)]",
  article: "border-[color:rgba(184,148,98,0.22)] bg-[color:rgba(184,148,98,0.12)] text-[var(--accent-article)]",
  image_prompt: "border-[color:rgba(182,111,120,0.22)] bg-[color:rgba(182,111,120,0.12)] text-[var(--accent-art)]",
  video_prompt: "border-[color:rgba(182,111,120,0.22)] bg-[color:rgba(182,111,120,0.12)] text-[var(--accent-art)]",
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
      <div className="flex flex-col items-center justify-center rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05] py-20">
        <FileText className="mb-4 h-10 w-10 text-[#6f695f]" />
        <p className="text-[#a49b8b]">No items found</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-[#d6c9b214] bg-[#ffffff05]">
      <Table>
        <TableHeader>
          <TableRow className="border-[#d6c9b214] hover:bg-transparent">
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
            <TableHead className="w-[56px] text-[#8a8174]">Thumb</TableHead>
            <TableHead className="text-[#8a8174]">Title / Preview</TableHead>
            <TableHead className="text-[#8a8174]">Author</TableHead>
            <TableHead className="text-[#8a8174]">Type</TableHead>
            <TableHead className="text-[#8a8174]">Date</TableHead>
            <TableHead className="w-[56px] text-[#8a8174]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow
              key={item.id}
              className="border-[#d6c9b214] hover:bg-[#ffffff06] data-[state=selected]:bg-[#ffffff08]"
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
                  item.thumbnail.endsWith(".mp4") ? (
                    <video
                      src={getMediaDisplayUrl(item.thumbnail, "")}
                      muted
                      preload="metadata"
                      className="h-10 w-10 rounded-[10px] object-cover"
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={getMediaDisplayUrl(item.thumbnail, "")}
                      alt=""
                      className="h-10 w-10 rounded-[10px] object-cover"
                    />
                  )
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#0f141b]">
                    <FileText className="h-4 w-4 text-[#6f695f]" />
                  </div>
                )}
              </TableCell>
              <TableCell className="max-w-[300px]">
                <div className="truncate font-medium text-[#f2ede5]">
                  {item.title || "Untitled"}
                </div>
                <div className="truncate text-xs text-[#a49b8b]">
                  {item.body_preview}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm text-[#f2ede5]">
                  {item.author_display_name || "—"}
                </div>
                {item.author_handle && (
                  <div className="text-xs text-[#8a8174]">
                    @{item.author_handle}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={TYPE_COLORS[item.source_type] || "text-[#a49b8b]"}
                >
                  {formatTypeName(item.source_type)}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-[#a49b8b]">
                {formatDate(item.posted_at)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 rounded-[10px] p-0 text-[#a49b8b] hover:bg-[#ffffff08] hover:text-[#f2ede5]"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="border-[#d6c9b214] bg-[#171b22]"
                  >
                    <DropdownMenuItem
                      onClick={() => onEdit(item)}
                      className="text-[#f2ede5] focus:bg-[#ffffff0a] focus:text-[#f2ede5]"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(item)}
                      className="text-red-300 focus:bg-[#ffffff0a] focus:text-red-300"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onReprocess(item)}
                      className="text-[#f2ede5] focus:bg-[#ffffff0a] focus:text-[#f2ede5]"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reprocess
                    </DropdownMenuItem>
                    {item.original_url && (
                      <DropdownMenuItem
                        asChild
                        className="text-[#f2ede5] focus:bg-[#ffffff0a] focus:text-[#f2ede5]"
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
