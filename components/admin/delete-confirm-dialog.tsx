"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmDialogProps {
  open: boolean;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({
  open,
  count,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="border-[#ffffff12] bg-[#111118]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[#f0f0f5]">
            Delete {count} item{count !== 1 ? "s" : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[#8888aa]">
            This action cannot be undone. The selected item{count !== 1 ? "s" : ""} will
            be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onCancel}
            className="rounded-[10px] border-[#ffffff12] bg-transparent text-[#f0f0f5] hover:bg-[#ffffff0a] hover:text-[#f0f0f5]"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="rounded-[10px] bg-red-600 text-white hover:bg-red-700"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
