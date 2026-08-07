'use client';

import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  guessMimeTypeFromFileName,
  isAndroidMobileContext,
  shareAndroidLinkNow,
} from '@/lib/android-attachment-share';

export type SaveGeneratedPdfResult = 'shared' | 'downloaded' | 'failed';

export type StagedNativeShareFile = {
  uri: string;
  path: string;
  directory: Directory;
  fileName: string;
  mimeType: string;
};

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
    Plugins?: Record<string, unknown>;
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

function hasCapacitorFilesystemBridge(): boolean {
  if (typeof window === 'undefined') return false;
  const hasCapacitorBridge = Boolean((window as CapacitorWindow).Capacitor);
  return Capacitor.isNativePlatform() || hasCapacitorBridge;
}

function isAndroidContext(): boolean {
  return isAndroidMobileContext();
}

/** Write blob to Capacitor cache and return a shareable content URI (background prefetch). */
export async function stageNativeShareFile(
  blob: Blob,
  fileName: string
): Promise<StagedNativeShareFile | null> {
  if (!hasCapacitorFilesystemBridge()) {
    return null;
  }

  const mimeType = blob.type || guessMimeTypeFromFileName(fileName);
  const base64 = await blobToBase64(blob);
  const safeName = fileName.replace(/[^\w.-]+/g, '_');
  const path = `warmpawz/${Date.now()}-${safeName}`;
  const directories = isAndroidContext()
    ? [Directory.Cache, Directory.External]
    : [Directory.Cache];

  for (const directory of directories) {
    try {
      const written = await Filesystem.writeFile({
        path,
        data: base64,
        directory,
        recursive: true,
      });

      const uriResult = await Filesystem.getUri({ path, directory });
      const shareUri = uriResult.uri || written.uri;
      if (!shareUri) {
        continue;
      }

      return {
        uri: shareUri,
        path,
        directory,
        fileName,
        mimeType,
      };
    } catch (err) {
      console.warn('[Native Save] stageNativeShareFile failed', { directory, err });
    }
  }

  return null;
}

/** Share a pre-staged content URI via Capacitor Share (fast tap path). */
export async function shareStagedNativeFile(
  staged: StagedNativeShareFile,
  options?: {
    title?: string;
    shareText?: string;
    shareDialogTitle?: string;
  }
): Promise<'shared' | 'failed'> {
  const title = options?.title ?? staged.fileName;
  const shareText = options?.shareText ?? staged.fileName;
  const shareDialogTitle = options?.shareDialogTitle ?? 'Save or share file';

  try {
    await Share.share({
      title,
      text: shareText,
      url: staged.uri,
      dialogTitle: shareDialogTitle,
    });
    console.log('[Native Save] Success via Share (pre-staged URI)');
    return 'shared';
  } catch (shareErr) {
    if ((shareErr as Error)?.name === 'AbortError') {
      return 'shared';
    }
    const viaBridged = await tryBridgedShare(
      staged.uri,
      staged.fileName,
      title,
      shareText,
      shareDialogTitle
    );
    if (viaBridged) {
      console.log('[Native Save] Success via bridged Share (pre-staged URI)');
      return 'shared';
    }

    if (isAndroidContext()) {
      const viaIntent = tryAndroidSendFileIntentWithUri(
        staged.uri,
        staged.mimeType,
        title
      );
      if (viaIntent === 'shared') {
        console.log('[Native Save] Success via SEND intent (pre-staged URI)');
        return 'shared';
      }
    }

    console.warn('[Native Save] shareStagedNativeFile failed', shareErr);
    return 'failed';
  }
}

export async function saveGeneratedPdfBlob(options: {
  blob: Blob;
  fileName: string;
  title?: string;
  shareText?: string;
  shareDialogTitle?: string;
  /** When set on Android, share this link immediately after blob save paths fail. */
  shareUrl?: string | null;
}): Promise<SaveGeneratedPdfResult> {
  const { blob, fileName, title, shareText, shareDialogTitle, shareUrl } = options;
  const mimeType = blob.type || 'application/octet-stream';
  const file = new File([blob], fileName, { type: mimeType });
  const useMobilePipeline = shouldUseMobileSavePipeline();
  const platform = Capacitor.getPlatform();
  const android = isAndroidContext();

  if (useMobilePipeline) {
    console.log('[Native Save] Started', { platform, mobilePipeline: true, native: Capacitor.isNativePlatform() });
  }

  try {
    if (!useMobilePipeline) {
      triggerAnchorDownload(blob, fileName);
      return 'downloaded';
    }

    const staged = await stageNativeShareFile(blob, fileName);
    if (staged) {
      const shared = await shareStagedNativeFile(staged, {
        title,
        shareText,
        shareDialogTitle,
      });
      if (shared === 'shared') {
        console.log('[Native Save] Success via Filesystem+Share');
        return 'shared';
      }
    }

    const viaWebShare = await tryWebShareWithFile(file, title, shareText);
    if (viaWebShare === 'shared') {
      console.log('[Native Save] Success via Web Share (file)');
      return 'shared';
    }

    if (android && shareUrl?.trim()) {
      const shared = await shareAndroidLinkNow({
        url: shareUrl.trim(),
        fileName,
        title,
      });
      if (shared !== 'failed') {
        console.log('[Native Save] Success via link share');
        return 'shared';
      }
    }

    console.log('[Native Save] Failed');
    return 'failed';
  } catch {
    console.log('[Native Save] Failed');
    return 'failed';
  }
}

/** Share a pre-staged Capacitor content URI on tap (single fast native call). */
export async function shareAndroidNativeUriNow(options: {
  staged: StagedNativeShareFile;
  title?: string | null;
}): Promise<boolean> {
  const title = options.title?.trim() || options.staged.fileName;

  try {
    const result = await shareStagedNativeFile(options.staged, {
      title,
      shareText: options.staged.fileName,
      shareDialogTitle: 'Save or share file',
    });
    if (result === 'shared') {
      return true;
    }
  } catch (err) {
    console.warn('[Native Save] native URI share failed', err);
  }

  try {
    if (
      tryAndroidSendFileIntentWithUri(
        options.staged.uri,
        options.staged.mimeType,
        title
      ) === 'shared'
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }

  return false;
}

export function isCapacitorShareAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Capacitor.isPluginAvailable('Share') || Capacitor.isPluginAvailable('Filesystem');
  } catch {
    return false;
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

  const payloads: ShareData[] = [
    { files: [file] },
    { files: [file], title: title ?? file.name },
    { files: [file], title: title ?? file.name, text: shareText ?? 'Save to Files or pick another app.' },
  ];

  for (const payload of payloads) {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  console.warn('[Native Save] Web Share with file failed for all payloads');
  return 'skipped';
}

async function tryBridgedShare(
  shareUri: string,
  fileName: string,
  title?: string,
  shareText?: string,
  shareDialogTitle?: string
): Promise<boolean> {
  const bridged = (window as CapacitorWindow).Capacitor?.Plugins?.Share as
    | { share?: (opts: Record<string, string>) => Promise<unknown> }
    | undefined;
  if (typeof bridged?.share !== 'function') {
    return false;
  }
  try {
    await bridged.share({
      title: title ?? fileName,
      text: shareText ?? 'Save to Drive, Files, or another app.',
      url: shareUri,
      dialogTitle: shareDialogTitle ?? 'Save file',
    });
    return true;
  } catch {
    return false;
  }
}

/** Hand off to Android SEND chooser with a content/file URI (MainActivity routes intent: schemes). */
export function tryAndroidSendFileIntentWithUri(
  fileUri: string,
  mimeType: string,
  title: string
): 'shared' | 'skipped' {
  if (!isAndroidContext() || !fileUri.trim()) {
    return 'skipped';
  }

  try {
    const stream = encodeURIComponent(fileUri);
    const subject = encodeURIComponent(title);
    const intentUrl =
      `intent:#Intent;action=android.intent.action.SEND;type=${encodeURIComponent(mimeType)};` +
      `S.android.intent.extra.STREAM=${stream};` +
      `S.android.intent.extra.SUBJECT=${subject};end`;
    window.location.href = intentUrl;
    return 'shared';
  } catch (err) {
    console.warn('[Native Save] Android SEND intent with URI failed', err);
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
