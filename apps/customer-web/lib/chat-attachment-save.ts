'use client';

import {
  isAndroidMobileContext,
  shareAndroidFileNow,
  shareAndroidLinkNow,
} from '@/lib/android-attachment-share';
import { shareAndroidNativeUriNow } from '@/lib/capacitor-pdf-save';
import {
  getAttachmentPrepareState,
  getChatAttachmentBlob,
  getNativeShareUri,
  isChatAttachmentBlobReady,
  isNativeShareReady,
  prefetchChatAttachmentBlob,
  waitForNativeShareReady,
  type AttachmentCacheInput,
} from '@/lib/chat-attachment-blob-cache';
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

export type ChatAttachmentSaveResult = DownloadSaveResult | 'preparing';

function chatFileApiPath(fileId: string): string {
  return `/chat/file/${fileId.split('/').map(encodeURIComponent).join('/')}`;
}

export function warmChatAttachmentCache(options: ChatAttachmentSaveOptions): void {
  if (!isAndroidMobileContext()) return;
  prefetchChatAttachmentBlob({
    fileUrl: options.fileUrl,
    fileId: options.fileId,
    fileName: options.fileName,
  });
}

export function resolveChatAttachmentUrl(options: {
  fileUrl?: string | null;
  fileId?: string | null;
}): string {
  const fileId = options.fileId?.trim();
  if (fileId) {
    const apiBaseUrl = getApiBaseUrl() || '';
    return `${apiBaseUrl}${chatFileApiPath(fileId)}`;
  }

  const fileUrl = options.fileUrl?.trim();
  if (fileUrl) {
    return fileUrl;
  }

  throw new Error('No file available');
}

export function resolveShareLinkUrl(options: {
  fileUrl?: string | null;
  fileId?: string | null;
}): string | null {
  const url = options.fileUrl?.trim();
  if (url) return url;

  const id = options.fileId?.trim();
  if (!id) return null;

  try {
    return resolveChatAttachmentUrl({ fileId: id });
  } catch {
    return null;
  }
}

function toCacheInput(options: ChatAttachmentSaveOptions): AttachmentCacheInput {
  return {
    fileUrl: options.fileUrl,
    fileId: options.fileId,
    fileName: options.fileName,
  };
}

export function getChatAttachmentPrepareState(
  options: ChatAttachmentSaveOptions
): ReturnType<typeof getAttachmentPrepareState> {
  return getAttachmentPrepareState(toCacheInput(options));
}

async function tryLinkShareFallback(options: {
  fileUrl?: string;
  fileId?: string;
  fileName: string;
  title: string;
}): Promise<boolean> {
  const linkUrl = resolveShareLinkUrl({ fileUrl: options.fileUrl, fileId: options.fileId });
  if (!linkUrl) return false;

  try {
    const result = await shareAndroidLinkNow({
      url: linkUrl,
      fileName: options.fileName,
      title: options.title,
    });
    return result !== 'failed';
  } catch (err) {
    console.warn('[ChatAttachment] link share fallback failed', err);
    return false;
  }
}

async function tryBlobFileShare(
  cacheInput: AttachmentCacheInput,
  fileName: string,
  title: string
): Promise<boolean> {
  if (!isChatAttachmentBlobReady(cacheInput)) return false;

  try {
    const blob = await getChatAttachmentBlob(cacheInput);
    if (!blob) return false;

    const result = await shareAndroidFileNow({ blob, fileName, title });
    return result === 'shared' || result === 'aborted';
  } catch {
    return false;
  }
}

async function saveOrShareOnAndroid(options: {
  fileUrl?: string;
  fileId?: string;
  fallbackName: string;
  title: string;
  cacheInput: AttachmentCacheInput;
}): Promise<{ fileName: string; saveResult: ChatAttachmentSaveResult }> {
  const { fileUrl, fileId, fallbackName, title, cacheInput } = options;

  prefetchChatAttachmentBlob(cacheInput);

  const prepareState = getAttachmentPrepareState(cacheInput);

  if (prepareState === 'failed') {
    if (await tryLinkShareFallback({ fileUrl, fileId, fileName: fallbackName, title })) {
      return { fileName: fallbackName, saveResult: 'shared' };
    }
  }

  if (isNativeShareReady(cacheInput)) {
    const staged = getNativeShareUri(cacheInput);
    if (staged) {
      const shared = await shareAndroidNativeUriNow({ staged, title });
      if (shared) {
        return { fileName: fallbackName, saveResult: 'shared' };
      }
    }
  } else if (prepareState === 'loading') {
    const staged = await waitForNativeShareReady(cacheInput, 8000);
    if (staged) {
      const shared = await shareAndroidNativeUriNow({ staged, title });
      if (shared) {
        return { fileName: fallbackName, saveResult: 'shared' };
      }
    }
  }

  if (await tryBlobFileShare(cacheInput, fallbackName, title)) {
    return { fileName: fallbackName, saveResult: 'shared' };
  }

  if (await tryLinkShareFallback({ fileUrl, fileId, fileName: fallbackName, title })) {
    return { fileName: fallbackName, saveResult: 'shared' };
  }

  if (fileId) {
    try {
      const result = await downloadFromApi({
        path: chatFileApiPath(fileId),
        fileName: fallbackName,
        title,
        shareText: 'Save to Files, Drive, or another app.',
        shareDialogTitle: 'Save or share file',
        previewHtmlInBrowser: false,
        shareUrl: resolveShareLinkUrl({ fileUrl, fileId }),
      });
      if (result.saveResult !== 'failed') {
        return result;
      }
    } catch (err) {
      console.warn('[ChatAttachment] api download failed', err);
    }
  } else if (fileUrl) {
    try {
      const result = await downloadFromUrl({
        url: fileUrl,
        fileName: fallbackName,
        title,
        shareText: 'Save to Files, Drive, or another app.',
        shareDialogTitle: 'Save or share file',
        previewHtmlInBrowser: false,
        shareUrl: fileUrl,
      });
      if (result.saveResult !== 'failed') {
        return result;
      }
    } catch (err) {
      console.warn('[ChatAttachment] url download failed', err);
    }
  }

  if (await tryLinkShareFallback({ fileUrl, fileId, fileName: fallbackName, title })) {
    return { fileName: fallbackName, saveResult: 'shared' };
  }

  return { fileName: fallbackName, saveResult: 'failed' };
}

export async function saveOrShareChatAttachment(
  options: ChatAttachmentSaveOptions
): Promise<{
  fileName: string;
  saveResult: ChatAttachmentSaveResult;
}> {
  const fallbackName =
    options.fileName?.trim() ||
    filenameFromUrl(options.fileUrl || options.fileId || '', 'document');
  const title = options.title?.trim() || fallbackName;
  const fileUrl = options.fileUrl?.trim();
  const fileId = options.fileId?.trim();
  const cacheInput = toCacheInput(options);

  if (isAndroidMobileContext()) {
    const prepareState = getAttachmentPrepareState(cacheInput);
    if (prepareState === 'loading' && !isNativeShareReady(cacheInput)) {
      return { fileName: fallbackName, saveResult: 'preparing' };
    }

    return saveOrShareOnAndroid({
      fileUrl,
      fileId,
      fallbackName,
      title,
      cacheInput,
    });
  }

  const common = {
    fileName: fallbackName,
    title,
    shareText: 'Save to Files, Drive, or another app.',
    shareDialogTitle: 'Save or share file',
    previewHtmlInBrowser: false,
    shareUrl: fileUrl ?? null,
  };

  if (fileId) {
    const { fileName, saveResult } = await downloadFromApi({
      path: chatFileApiPath(fileId),
      ...common,
    });
    return { fileName, saveResult };
  }

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
  saveResult: ChatAttachmentSaveResult,
  fileName?: string
): string {
  if (saveResult === 'preparing') {
    return `Preparing ${fileName || 'file'}…`;
  }
  if (saveResult === 'shared' && isAndroidMobileContext()) {
    return `Choose an app to save or share ${fileName || 'the file'}.`;
  }
  return getDownloadMessage(saveResult, fileName || 'file');
}
