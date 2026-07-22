'use client';

import { getApiBaseUrl } from '@/lib/api-client';
import {
  downloadFromApi,
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
  const fallbackName =
    options.fileName?.trim() ||
    filenameFromUrl(options.fileUrl || options.fileId || '', 'document');
  const title = options.title?.trim() || fallbackName;
  const common = {
    fileName: fallbackName,
    title,
    shareText: 'Save to Files, Drive, or another app.',
    shareDialogTitle: 'Save or share file',
    previewHtmlInBrowser: false,
  };

  const fileId = options.fileId?.trim();
  if (fileId) {
    const { fileName, saveResult } = await downloadFromApi({
      path: `/chat/file/${encodeURIComponent(fileId)}`,
      ...common,
    });
    return { fileName, saveResult };
  }

  const fileUrl = options.fileUrl?.trim();
  if (fileUrl) {
    const { fileName, saveResult } = await downloadFromUrl({
      url: fileUrl,
      ...common,
    });
    return { fileName, saveResult };
  }

  throw new Error('No file available');
}

export function getChatAttachmentSaveMessage(
  saveResult: DownloadSaveResult,
  fileName?: string
): string {
  return getDownloadMessage(saveResult, fileName || 'file');
}
