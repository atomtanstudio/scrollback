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
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#ffffff12] bg-[#111118]/95 px-6 py-3 backdrop-blur-sm transition-all duration-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <span className="text-sm font-medium text-[#f0f0f5]">
          {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
        </span>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onReprocess}
            className="rounded-[10px] border-[#ffffff12] bg-transparent text-[#f0f0f5] hover:bg-[#ffffff0a]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reprocess Selected
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="rounded-[10px] border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-[#8888aa] hover:text-[#f0f0f5]"
          >
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
