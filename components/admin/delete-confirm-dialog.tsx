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
      <AlertDialogContent className="rounded-[24px] border-[#d6c9b214] bg-[#171b22]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[#f2ede5]">
            Delete {count} item{count !== 1 ? "s" : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[#a49b8b]">
            This action cannot be undone. The selected item{count !== 1 ? "s" : ""} will
            be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onCancel}
            className="rounded-[12px] border-[#d6c9b214] bg-[#ffffff05] text-[#f2ede5] hover:border-[#d6c9b233] hover:bg-[#ffffff08] hover:text-[#f2ede5]"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="rounded-[12px] bg-red-600 text-white hover:bg-red-700"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
