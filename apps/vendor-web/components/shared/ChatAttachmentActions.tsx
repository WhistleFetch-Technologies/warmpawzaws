'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { shouldUseMobileSavePipeline } from '@/lib/capacitor-pdf-save';
import {
  getChatAttachmentSaveMessage,
  saveOrShareChatAttachment,
} from '@/lib/chat-attachment-save';

export type ChatAttachmentActionsProps = {
  fileUrl?: string | null;
  fileId?: string | null;
  fileName?: string | null;
  title?: string | null;
  className?: string;
  /** Dark bubble styling for in-call video chat */
  compact?: boolean;
};

export function ChatAttachmentActions({
  fileUrl,
  fileId,
  fileName,
  title,
  className,
  compact = false,
}: ChatAttachmentActionsProps) {
  const [saving, setSaving] = useState(false);

  const label = shouldUseMobileSavePipeline() ? 'Save or share' : 'Download';

  const handleSave = async () => {
    if (saving) return;
    if (!fileUrl?.trim() && !fileId?.trim()) {
      toast.error('File is not available');
      return;
    }

    setSaving(true);
    try {
      const { fileName: savedName, saveResult } = await saveOrShareChatAttachment({
        fileUrl,
        fileId,
        fileName,
        title,
      });

      if (saveResult === 'failed') {
        toast.error(getChatAttachmentSaveMessage(saveResult, savedName));
        return;
      }

      toast.success(getChatAttachmentSaveMessage(saveResult, savedName));
    } catch (err) {
      console.warn('[ChatAttachmentActions] save failed', err);
      toast.error('Could not save or share this file. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const baseClass = compact
    ? 'text-xs underline opacity-90 text-left disabled:opacity-50 inline-flex items-center gap-1'
    : 'text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 inline-flex items-center gap-1';

  return (
    <button
      type="button"
      onClick={() => void handleSave()}
      disabled={saving}
      className={className ? `${baseClass} ${className}` : baseClass}
    >
      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
      {label}
    </button>
  );
}
