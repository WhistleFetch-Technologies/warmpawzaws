'use client';

import { getApiBaseUrl } from '@/lib/api-client';
import {
  downloadFromUrl,
  filenameFromUrl,
  getDownloadMessage,
  type DownloadSaveResult,
} from '@/lib/download-file';

export type ChatAttachmentSaveOptions = {
  fileUrl?: string | null;
  fileId?: string | null;
  fileName?: string | null;
  title?: string | null;
};

/** Prefer file_id API path (fresh presigned redirect) over possibly expired file_url. */
export function resolveChatAttachmentUrl(options: {
  fileUrl?: string | null;
  fileId?: string | null;
}): string {
  const fileId = options.fileId?.trim();
  if (fileId) {
    const apiBaseUrl = getApiBaseUrl() || '';
    return `${apiBaseUrl}/chat/file/${encodeURIComponent(fileId)}`;
  }

  const fileUrl = options.fileUrl?.trim();
  if (fileUrl) {
    return fileUrl;
  }

  throw new Error('No file available');
}

export async function saveOrShareChatAttachment(
  options: ChatAttachmentSaveOptions
): Promise<{
  fileName: string;
  saveResult: DownloadSaveResult;
}> {
  const url = resolveChatAttachmentUrl(options);
  const fallbackName = options.fileName?.trim() || filenameFromUrl(url, 'document');
  const title = options.title?.trim() || fallbackName;

  const { fileName, saveResult } = await downloadFromUrl({
    url,
    fileName: fallbackName,
    title,
    shareText: 'Save to Files, Drive, or another app.',
    shareDialogTitle: 'Save or share file',
    previewHtmlInBrowser: false,
  });

  return { fileName, saveResult };
}

export function getChatAttachmentSaveMessage(
  saveResult: DownloadSaveResult,
  fileName?: string
): string {
  return getDownloadMessage(saveResult, fileName || 'file');
}
