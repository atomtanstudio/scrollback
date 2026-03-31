"use client";

import { useState } from "react";
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

interface ManualCaptureDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  userId?: string;
}

export function ManualCaptureDialog({
  open,
  onClose,
  onCreated,
  userId,
}: ManualCaptureDialogProps) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [sourceType, setSourceType] = useState("tweet");
  const [authorHandle, setAuthorHandle] = useState("");
  const [title, setTitle] = useState("");
  const [postedAt, setPostedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setSourceUrl("");
    setBodyText("");
    setSourceType("tweet");
    setAuthorHandle("");
    setTitle("");
    setPostedAt("");
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!sourceUrl.trim() && !bodyText.trim()) {
      setError("Please provide at least a source URL or body text.");
      return;
    }

    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        source_type: sourceType,
      };
      if (sourceUrl.trim()) payload.source_url = sourceUrl.trim();
      if (bodyText.trim()) payload.body_text = bodyText.trim();
      if (authorHandle.trim()) payload.author_handle = authorHandle.trim();
      if (title.trim()) payload.title = title.trim();
      if (postedAt) payload.posted_at = new Date(postedAt).toISOString();
      if (userId) payload.userId = userId;

      const res = await fetch("/api/admin/items/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create item");
      }

      resetForm();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create item");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[24px] border-[#d6c9b214] bg-[#171b22] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-[#f2ede5]">
            Manual Capture
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label className="text-[#8a8174]">Source URL</Label>
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="h-10 rounded-[12px] border-[#d6c9b214] bg-[#0f141b] px-4 text-sm text-[#f2ede5]"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-[#8a8174]">Body Text</Label>
            <Textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Paste or type content..."
              rows={4}
              className="rounded-[12px] border-[#d6c9b214] bg-[#0f141b] px-4 py-2 text-sm text-[#f2ede5]"
            />
          </div>

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
            <Label className="text-[#8a8174]">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional title"
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
            onClick={handleClose}
            className="rounded-[12px] border-[#d6c9b214] bg-[#ffffff05] text-[#f2ede5] hover:border-[#d6c9b233] hover:bg-[#ffffff08]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-[14px] bg-[var(--accent-article)] text-[#090c11] font-heading font-semibold hover:brightness-110"
          >
            {saving ? "Creating..." : "Create Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
