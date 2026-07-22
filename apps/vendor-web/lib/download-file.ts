'use client';

import { Capacitor } from '@capacitor/core';
import { getApiBaseUrl, getVendorAuthHeadersForUpload } from '@/lib/api-client';
import { saveGeneratedPdfBlob, shouldUseMobileSavePipeline, type SaveGeneratedPdfResult } from '@/lib/capacitor-pdf-save';

export type DownloadSaveResult =
  | SaveGeneratedPdfResult
  | 'web-opened'
  | 'web-downloaded';

export function getAuthHeaders(): Record<string, string> {
  return getVendorAuthHeadersForUpload();
}

export function getDownloadMessage(
  saveResult: DownloadSaveResult,
  label = 'file'
): string {
  switch (saveResult) {
    case 'shared':
      return isIosContext()
        ? `Tap "Save to Files" in the share sheet to keep the ${label}.`
        : `Choose Files, Drive, or another app in the share sheet to save the ${label}.`;
    case 'downloaded':
      return Capacitor.getPlatform() === 'android'
        ? `${label} opened — use the menu (⋮) to save or share the file.`
        : `${label} downloaded.`;
    case 'web-opened':
      return `${label} opened in your browser`;
    case 'web-downloaded':
      return `${label} downloaded`;
    case 'failed':
      return `Could not save the ${label} on this device. Please try again.`;
  }
}

function isIosContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (Capacitor.getPlatform() === 'ios') return true;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function resolveFilenameFromResponse(
  response: Response,
  fallbackFileName: string
): string {
  const contentDisposition = response.headers.get('Content-Disposition') || '';
  const dispositionMatch = contentDisposition.match(/filename[*]?=(?:UTF-8''|")?([^";\n]+)"?/i);
  let filename = dispositionMatch?.[1]?.trim();
  if (filename) {
    try {
      filename = decodeURIComponent(filename);
    } catch {
      /* keep raw */
    }
    return filename;
  }
  return fallbackFileName;
}

export function filenameFromUrl(url: string, fallbackFileName: string): string {
  try {
    const pathname = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://local').pathname;
    const segment = pathname.split('/').filter(Boolean).pop();
    if (segment && segment.includes('.')) {
      return decodeURIComponent(segment);
    }
  } catch {
    /* use fallback */
  }
  return fallbackFileName;
}

export async function blobFromDownloadResponse(
  response: Response,
  fallbackFileName: string
): Promise<{ blob: Blob; filename: string; isHtml: boolean }> {
  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
  const filename = resolveFilenameFromResponse(response, fallbackFileName);
  const isPdf = contentType.includes('application/pdf');
  const isHtml =
    contentType.includes('text/html') ||
    filename.endsWith('.html') ||
    (!isPdf && !contentType.includes('application/json'));

  const rawBlob = await response.blob();
  const mimeType = isPdf
    ? 'application/pdf'
    : isHtml
      ? 'text/html'
      : rawBlob.type || 'application/octet-stream';
  const blob =
    rawBlob.type && rawBlob.type !== 'application/octet-stream'
      ? rawBlob
      : new Blob([rawBlob], { type: mimeType });

  return { blob, filename, isHtml };
}

function resolveApiUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const apiBaseUrl = getApiBaseUrl() || '';
  return `${apiBaseUrl}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

async function fetchFileResponse(
  url: string,
  headers: Record<string, string> = {}
): Promise<Response> {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error('Failed to download file');
  }

  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return response;
  }

  const json = await response.json();
  const presignedUrl = json.downloadUrl ?? json.download_url;
  if (!presignedUrl || typeof presignedUrl !== 'string') {
    throw new Error('Download URL not available');
  }

  const fileResponse = await fetch(presignedUrl);
  if (!fileResponse.ok) {
    throw new Error('Failed to download file from storage');
  }
  return fileResponse;
}

export async function downloadBlob(options: {
  blob: Blob;
  fileName: string;
  title?: string;
  shareText?: string;
  shareDialogTitle?: string;
  previewHtmlInBrowser?: boolean;
}): Promise<{
  fileName: string;
  saveResult: DownloadSaveResult;
  openedInBrowser: boolean;
}> {
  const {
    blob,
    fileName,
    title,
    shareText,
    shareDialogTitle,
    previewHtmlInBrowser = false,
  } = options;

  const isHtml =
    previewHtmlInBrowser ||
    blob.type.includes('text/html') ||
    fileName.endsWith('.html');

  if (shouldUseMobileSavePipeline()) {
    const saveResult = await saveGeneratedPdfBlob({
      blob,
      fileName,
      title: title ?? fileName,
      shareText: shareText ?? 'Save to Files, Drive, or another app.',
      shareDialogTitle: shareDialogTitle ?? 'Save file',
    });
    return { fileName, saveResult, openedInBrowser: false };
  }

  const blobUrl = window.URL.createObjectURL(blob);
  let openedInBrowser = false;

  if (isHtml && previewHtmlInBrowser !== false) {
    const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
    openedInBrowser = Boolean(opened);
  }

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);

  const saveResult: DownloadSaveResult = openedInBrowser ? 'web-opened' : 'web-downloaded';
  return { fileName, saveResult, openedInBrowser };
}

export async function downloadFromUrl(options: {
  url: string;
  fileName?: string;
  headers?: Record<string, string>;
  title?: string;
  shareText?: string;
  shareDialogTitle?: string;
  previewHtmlInBrowser?: boolean;
}): Promise<{
  fileName: string;
  saveResult: DownloadSaveResult;
  openedInBrowser: boolean;
}> {
  const resolvedUrl = resolveApiUrl(options.url);
  const fallbackFileName = options.fileName ?? filenameFromUrl(resolvedUrl, 'download');
  const headers = options.headers ?? {};

  const response = await fetchFileResponse(resolvedUrl, headers);
  const { blob, filename, isHtml } = await blobFromDownloadResponse(response, fallbackFileName);

  return downloadBlob({
    blob,
    fileName: filename,
    title: options.title,
    shareText: options.shareText,
    shareDialogTitle: options.shareDialogTitle,
    previewHtmlInBrowser: options.previewHtmlInBrowser ?? isHtml,
  });
}

export async function downloadFromApi(options: {
  path: string;
  fileName?: string;
  method?: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
  title?: string;
  shareText?: string;
  shareDialogTitle?: string;
  previewHtmlInBrowser?: boolean;
}): Promise<{
  fileName: string;
  saveResult: DownloadSaveResult;
  openedInBrowser: boolean;
}> {
  const url = resolveApiUrl(options.path);
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  };

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body,
  });

  if (!response.ok) {
    throw new Error('Failed to download file');
  }

  const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    return downloadFromUrl({
      url,
      fileName: options.fileName,
      headers,
      title: options.title,
      shareText: options.shareText,
      shareDialogTitle: options.shareDialogTitle,
      previewHtmlInBrowser: options.previewHtmlInBrowser,
    });
  }

  const fallbackFileName = options.fileName ?? filenameFromUrl(url, 'download');
  const { blob, filename, isHtml } = await blobFromDownloadResponse(response, fallbackFileName);

  return downloadBlob({
    blob,
    fileName: filename,
    title: options.title,
    shareText: options.shareText,
    shareDialogTitle: options.shareDialogTitle,
    previewHtmlInBrowser: options.previewHtmlInBrowser ?? isHtml,
  });
}
