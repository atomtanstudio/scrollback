"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminItem } from "@/components/admin/columns";

interface ItemEditDialogProps {
  item: AdminItem | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function toDatetimeLocal(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  // Format as YYYY-MM-DDTHH:MM
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ItemEditDialog({
  item,
  open,
  onClose,
  onSaved,
}: ItemEditDialogProps) {
  const [sourceType, setSourceType] = useState("");
  const [authorHandle, setAuthorHandle] = useState("");
  const [authorDisplayName, setAuthorDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [postedAt, setPostedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setSourceType(item.source_type);
      setAuthorHandle(item.author_handle || "");
      setAuthorDisplayName(item.author_display_name || "");
      setTitle(item.title || "");
      setBodyText(item.body_text || "");
      setOriginalUrl(item.original_url || "");
      setPostedAt(toDatetimeLocal(item.posted_at));
      setError(null);
    }
  }, [item]);

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: sourceType,
          author_handle: authorHandle || null,
          author_display_name: authorDisplayName || null,
          title: title || null,
          body_text: bodyText || null,
          original_url: originalUrl || null,
          posted_at: postedAt ? new Date(postedAt).toISOString() : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[24px] border-[#d6c9b214] bg-[#171b22] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-[#f2ede5]">
            Edit Item
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label className="text-[#8a8174]">Source Type</Label>
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger className="h-10 rounded-[12px] border-[#d6c9b214] bg-[#0f141b] text-sm text-[#f2ede5]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[#d6c9b214] bg-[#171b22] text-[#f2ede5]">
                <SelectItem value="tweet">Tweet</SelectItem>
                <SelectItem value="thread">Thread</SelectItem>
                <SelectItem value="article">Article</SelectItem>
                <SelectItem value="image_prompt">Image Prompt</SelectItem>
                <SelectItem value="video_prompt">Video Prompt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label className="text-[#8a8174]">Author Handle</Label>
            <Input
              value={authorHandle}
              onChange={(e) => setAuthorHandle(e.target.value)}
              placeholder="@handle"
              className="h-10 rounded-[12px] border-[#d6c9b214] bg-[#0f141b] px-4 text-sm text-[#f2ede5]"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-[#8a8174]">Display Name</Label>
            <Input
              value={authorDisplayName}
              onChange={(e) => setAuthorDisplayName(e.target.value)}
              placeholder="Display name"
              className="h-10 rounded-[12px] border-[#d6c9b214] bg-[#0f141b] px-4 text-sm text-[#f2ede5]"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-[#8a8174]">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="h-10 rounded-[12px] border-[#d6c9b214] bg-[#0f141b] px-4 text-sm text-[#f2ede5]"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-[#8a8174]">Body Text</Label>
            <Textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Body text"
              rows={4}
              className="rounded-[12px] border-[#d6c9b214] bg-[#0f141b] px-4 py-2 text-sm text-[#f2ede5]"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-[#8a8174]">Original URL</Label>
            <Input
              value={originalUrl}
              onChange={(e) => setOriginalUrl(e.target.value)}
              placeholder="https://..."
              className="h-10 rounded-[12px] border-[#d6c9b214] bg-[#0f141b] px-4 text-sm text-[#f2ede5]"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-[#8a8174]">Posted At</Label>
            <Input
              type="datetime-local"
              value={postedAt}
              onChange={(e) => setPostedAt(e.target.value)}
              className="h-10 rounded-[12px] border-[#d6c9b214] bg-[#0f141b] px-4 text-sm text-[#f2ede5]"
            />
          </div>

          {error && (
            <div className="rounded-[12px] bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-[12px] border-[#d6c9b214] bg-[#ffffff05] text-[#f2ede5] hover:border-[#d6c9b233] hover:bg-[#ffffff08]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-[14px] bg-[var(--accent-article)] text-[#090c11] font-heading font-semibold hover:brightness-110"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
