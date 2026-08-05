'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isAndroidMobileContext, shareAndroidLinkNow } from '@/lib/android-attachment-share';
import { shouldUseMobileSavePipeline } from '@/lib/capacitor-pdf-save';
import {
  getChatAttachmentSaveMessage,
  resolveShareLinkUrl,
  saveOrShareChatAttachment,
  warmChatAttachmentCache,
} from '@/lib/chat-attachment-save';

export type ChatAttachmentActionsProps = {
  fileUrl?: string | null;
  fileId?: string | null;
  fileName?: string | null;
  title?: string | null;
  className?: string;
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

  const cacheOptions = { fileUrl, fileId, fileName, title };
  const isAndroid = isAndroidMobileContext();
  const useMobilePipeline = shouldUseMobileSavePipeline();
  const displayName = fileName?.trim() || 'document';
  const label = useMobilePipeline ? 'Save or share' : 'Download';

  useEffect(() => {
    warmChatAttachmentCache(cacheOptions);
  }, [fileUrl, fileId, fileName, title]);

  const handleSave = async () => {
    if (saving) return;

    const linkUrl = resolveShareLinkUrl({ fileUrl, fileId });
    if (!linkUrl) {
      toast.error('File link is not available');
      return;
    }

    setSaving(true);
    try {
      if (isAndroid) {
        const result = await shareAndroidLinkNow({
          url: linkUrl,
          fileName: displayName,
          title,
        });

        if (result === 'shared') {
          toast.success(getChatAttachmentSaveMessage('shared', displayName));
          return;
        }

        if (result === 'copied') {
          toast.success(`Link copied. Paste in WhatsApp, Notes, or any app to share ${displayName}.`);
          return;
        }

        toast.error('Could not open share. Please try again.');
        return;
      }

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
