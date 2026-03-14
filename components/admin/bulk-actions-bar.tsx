"use client";

import { Button } from "@/components/ui/button";
import { Trash2, RefreshCw, X } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onDelete: () => void;
  onReprocess: () => void;
  onClear: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onDelete,
  onReprocess,
  onClear,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 rounded-[24px] border border-[#d6c9b214] bg-[#171b22]/96 px-6 py-4 shadow-[0_24px_64px_rgba(2,6,12,0.35)] backdrop-blur-sm transition-all duration-200 sm:left-6 sm:right-6 lg:left-8 lg:right-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <span className="text-sm font-medium text-[#f2ede5]">
          {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
        </span>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onReprocess}
            className="rounded-[12px] border-[#d6c9b214] bg-[#ffffff05] text-[#f2ede5] hover:border-[#d6c9b233] hover:bg-[#ffffff08]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reprocess Selected
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="rounded-[12px] border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-[#a49b8b] hover:bg-transparent hover:text-[#f2ede5]"
          >
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
