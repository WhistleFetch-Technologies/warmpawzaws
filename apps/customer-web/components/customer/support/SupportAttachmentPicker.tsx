"use client";

import { useRef, useState } from "react";
import { Paperclip, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  type SupportAttachment,
  uploadSupportAttachment,
  validateSupportAttachmentFile,
  SUPPORT_ATTACHMENT_LIMITS,
} from "@/lib/support-attachment-upload";
import { getResolvedCustomerId } from "@/lib/customer-id-storage";
import { toast } from "sonner";

interface SupportAttachmentPickerProps {
  attachments: SupportAttachment[];
  onChange: (attachments: SupportAttachment[]) => void;
  disabled?: boolean;
  compact?: boolean;
  /** icon = paperclip circle only; composer = chips list (no attach button) */
  mode?: "default" | "icon" | "composer";
}

export function SupportAttachmentPicker({
  attachments,
  onChange,
  disabled = false,
  compact = false,
  mode = "default",
}: SupportAttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || disabled || uploading) return;

    const customerId = getResolvedCustomerId() || undefined;
    let next = [...attachments];

    for (const file of Array.from(files)) {
      const validationError = validateSupportAttachmentFile(file, next.length);
      if (validationError) {
        toast.error(validationError);
        continue;
      }

      setUploading(true);
      const result = await uploadSupportAttachment(file, customerId);
      setUploading(false);

      if (result.success && result.attachment) {
        next = [...next, result.attachment];
      } else {
        toast.error(result.error || "Failed to upload attachment");
      }

      if (next.length >= SUPPORT_ATTACHMENT_LIMITS.maxFiles) break;
    }

    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (index: number) => {
    onChange(attachments.filter((_, i) => i !== index));
  };

  const atLimit = attachments.length >= SUPPORT_ATTACHMENT_LIMITS.maxFiles;

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*,.pdf,application/pdf"
      multiple
      className="hidden"
      disabled={disabled || uploading || atLimit}
      onChange={(e) => void handleFiles(e.target.files)}
    />
  );

  if (mode === "composer") {
    if (attachments.length === 0) return null;
    return (
      <ul className="flex flex-wrap gap-2">
        {attachments.map((file, index) => (
          <li
            key={`${file.fileKey || file.url}-${index}`}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 max-w-full"
          >
            <Paperclip className="w-3 h-3 shrink-0 text-gray-400" />
            <span className="truncate max-w-[140px]">{file.name}</span>
            <button
              type="button"
              className="text-gray-400 hover:text-red-500 shrink-0"
              onClick={() => removeAt(index)}
              disabled={disabled || uploading}
              aria-label={`Remove ${file.name}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  if (mode === "icon") {
    return (
      <>
        {fileInput}
        <button
          type="button"
          disabled={disabled || uploading || atLimit}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF3E8] text-[#FF8C42] transition-colors",
            "hover:bg-[#FFE8D4] disabled:opacity-50"
          )}
          aria-label="Attach file"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Paperclip className="w-4 h-4" />
          )}
        </button>
      </>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {fileInput}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 text-xs"
          disabled={disabled || uploading || atLimit}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Paperclip className="w-3.5 h-3.5" />
          )}
          Attach file
        </Button>
        <span className="text-[11px] text-gray-500">
          Images or PDF, max {SUPPORT_ATTACHMENT_LIMITS.maxFiles} files ({SUPPORT_ATTACHMENT_LIMITS.maxFileSizeMb}MB each)
        </span>
      </div>

      {attachments.length > 0 && (
        <ul className={`flex flex-wrap gap-2 ${compact ? "" : "mt-1"}`}>
          {attachments.map((file, index) => (
            <li
              key={`${file.fileKey || file.url}-${index}`}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 max-w-full"
            >
              <Paperclip className="w-3 h-3 shrink-0 text-gray-400" />
              <span className="truncate max-w-[140px]">{file.name}</span>
              <button
                type="button"
                className="text-gray-400 hover:text-red-500 shrink-0"
                onClick={() => removeAt(index)}
                disabled={disabled || uploading}
                aria-label={`Remove ${file.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
