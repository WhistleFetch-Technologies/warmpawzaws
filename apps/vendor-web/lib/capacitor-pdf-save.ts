'use client';

import { Capacitor } from '@capacitor/core';

export type SaveGeneratedPdfResult = 'shared' | 'downloaded' | 'failed';

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
};

/** True in Capacitor app WebView (incl. remote server.url) or phone browser. */
export function shouldUseMobileSavePipeline(): boolean {
  if (typeof window === 'undefined') return false;

  if (Capacitor.isNativePlatform()) return true;

  const cap = (window as CapacitorWindow).Capacitor;
  if (cap?.isNativePlatform?.()) return true;

  const platform = cap?.getPlatform?.() ?? Capacitor.getPlatform();
  if (platform === 'ios' || platform === 'android') return true;

  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function isAndroidContext(): boolean {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return true;
  return /Android/i.test(navigator.userAgent);
}

function isIosContext(): boolean {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return true;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export async function saveGeneratedPdfBlob(options: {
  blob: Blob;
  fileName: string;
  title?: string;
  shareText?: string;
  shareDialogTitle?: string;
}): Promise<SaveGeneratedPdfResult> {
  const { blob, fileName, title, shareText, shareDialogTitle } = options;
  const mimeType = blob.type || 'application/octet-stream';
  const file = new File([blob], fileName, { type: mimeType });
  const useMobilePipeline = shouldUseMobileSavePipeline();
  const platform = Capacitor.getPlatform();

  if (useMobilePipeline) {
    console.log('[Native Save] Started', { platform, mobilePipeline: true });
  }

  try {
    if (!useMobilePipeline) {
      triggerAnchorDownload(blob, fileName);
      return 'downloaded';
    }

    const viaPlugins = await tryFilesystemAndShare(
      blob,
      fileName,
      title,
      shareText,
      shareDialogTitle
    );
    if (viaPlugins === 'shared') {
      console.log('[Native Save] Success via Filesystem+Share');
      return 'shared';
    }

    const viaWebShare = await tryWebShareWithFile(file, title, shareText);
    if (viaWebShare === 'shared') {
      console.log('[Native Save] Success via Web Share');
      return 'shared';
    }

    if (isAndroidContext()) {
      const viaAndroidOpen = tryAndroidOpenBlob(blob);
      if (viaAndroidOpen === 'downloaded') {
        console.log('[Native Save] Opened file in WebView (use menu to save)');
        return 'downloaded';
      }
    }

    console.log('[Native Save] Failed');
    return 'failed';
  } catch {
    console.log('[Native Save] Failed');
    return 'failed';
  }
}

function triggerAnchorDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function tryWebShareWithFile(
  file: File,
  title?: string,
  shareText?: string
): Promise<'shared' | 'skipped'> {
  if (typeof navigator.share !== 'function') {
    return 'skipped';
  }

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
  };

  const isAndroid = isAndroidContext();
  const isIos = isIosContext();

  if (
    !isAndroid &&
    !isIos &&
    (typeof nav.canShare !== 'function' || !nav.canShare({ files: [file] }))
  ) {
    return 'skipped';
  }

  try {
    await navigator.share({
      files: [file],
      title: title ?? file.name,
      text: shareText ?? 'Save to Files or pick another app.',
    });
    return 'shared';
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return 'shared';
    }
    console.warn('[Native Save] Web Share failed', err);
    return 'skipped';
  }
}

async function tryFilesystemAndShare(
  blob: Blob,
  fileName: string,
  title?: string,
  shareText?: string,
  shareDialogTitle?: string
): Promise<'shared' | 'skipped'> {
  if (!shouldUseMobileSavePipeline()) {
    return 'skipped';
  }

  try {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);

    const base64 = await blobToBase64(blob);
    const safeName = fileName.replace(/[^\w.-]+/g, '_');
    const path = `warmpawz/${Date.now()}-${safeName}`;

    const written = await Filesystem.writeFile({
      path,
      data: base64,
      directory: isAndroidContext() ? Directory.Documents : Directory.Cache,
      recursive: true,
    });

    await Share.share({
      title: title ?? fileName,
      text: shareText ?? 'Save to Drive, Files, or another app.',
      url: written.uri,
      dialogTitle: shareDialogTitle ?? 'Save file',
    });

    return 'shared';
  } catch (err) {
    console.warn('[Native Save] Filesystem+Share failed', err);
    return 'skipped';
  }
}

function tryAndroidOpenBlob(blob: Blob): 'downloaded' | 'skipped' {
  if (!isAndroidContext()) {
    return 'skipped';
  }

  try {
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank');
    if (!opened) {
      URL.revokeObjectURL(url);
      return 'skipped';
    }
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return 'downloaded';
  } catch {
    return 'skipped';
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read blob'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}
