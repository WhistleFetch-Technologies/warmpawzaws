'use client';

import { Capacitor } from '@capacitor/core';

export type SaveGeneratedPdfResult = 'shared' | 'downloaded' | 'failed';

export async function saveGeneratedPdfBlob(options: {
  blob: Blob;
  fileName: string;
  title?: string;
  shareText?: string;
}): Promise<SaveGeneratedPdfResult> {
  const { blob, fileName, title, shareText } = options;
  const mimeType = blob.type || 'application/pdf';
  const file = new File([blob], fileName, { type: mimeType });
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  if (isNative) {
    console.log('[Native Save] Started', { platform });
  }

  try {
    if (!isNative) {
      triggerAnchorDownload(blob, fileName);
      return 'downloaded';
    }

    const viaPlugins = await tryFilesystemAndShare(blob, fileName, title, shareText);
    if (viaPlugins === 'shared') {
      console.log('[Native Save] Success via Filesystem+Share');
      return 'shared';
    }

    const viaWebShare = await tryWebShareWithFile(file, title, shareText);
    if (viaWebShare === 'shared') {
      console.log('[Native Save] Success via Web Share');
      return 'shared';
    }

    // Anchor download does not write to user-visible storage inside Capacitor WebView.
    // On Android it often "succeeds" with no file in Downloads — do not treat as success.
    if (platform === 'android') {
      console.log('[Native Save] Failed — Web Share unavailable on Android WebView');
      return 'failed';
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

  const isAndroid = Capacitor.getPlatform() === 'android';
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
  };

  // Android WebView often reports canShare=false even when share({ files }) works.
  if (
    !isAndroid &&
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
  shareText?: string
): Promise<'shared' | 'skipped'> {
  if (
    !Capacitor.isPluginAvailable('Filesystem') ||
    !Capacitor.isPluginAvailable('Share')
  ) {
    return 'skipped';
  }

  try {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import(/* webpackIgnore: true */ '@capacitor/filesystem'),
      import(/* webpackIgnore: true */ '@capacitor/share'),
    ]);

    const base64 = await blobToBase64(blob);
    const safeName = fileName.replace(/[^\w.-]+/g, '_');
    const path = `warmpawz/${Date.now()}-${safeName}`;

    const written = await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });

    await Share.share({
      title: title ?? fileName,
      text: shareText,
      url: written.uri,
    });

    return 'shared';
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
