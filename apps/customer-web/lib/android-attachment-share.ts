'use client';

import { Capacitor } from '@capacitor/core';

type WebSharePayload = Pick<ShareData, 'title' | 'text' | 'url'>;

const ANDROID_INTENT_TEXT_MAX = 4000;

/** Android device — incl. Capacitor remote-URL WebView (platform may read "web"). */
export function isAndroidMobileContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (Capacitor.getPlatform() === 'android') return true;
  return /Android/i.test(navigator.userAgent);
}

/** @deprecated Use isAndroidMobileContext */
export function isAndroidNativeContext(): boolean {
  return isAndroidMobileContext();
}

function isNonEmptyWebShareData(data: WebSharePayload): boolean {
  return !!(data.text?.trim() || data.url?.trim() || data.title?.trim());
}

export async function invokeAndroidWebShare(
  payloads: WebSharePayload[]
): Promise<'shared' | 'aborted' | 'failed'> {
  if (typeof navigator.share !== 'function') {
    return 'failed';
  }

  for (const data of payloads) {
    if (!isNonEmptyWebShareData(data)) continue;
    try {
      await navigator.share(data);
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        return 'aborted';
      }
    }
  }

  return 'failed';
}

/** Android SEND chooser via intent: (MainActivity routes intent: schemes). */
export function triggerAndroidSendIntent(title: string, textPayload: string): void {
  const safeText =
    textPayload.length > ANDROID_INTENT_TEXT_MAX
      ? `${textPayload.slice(0, ANDROID_INTENT_TEXT_MAX - 20)}…`
      : textPayload;

  const intent =
    'intent:#Intent;action=android.intent.action.SEND;type=text/plain;' +
    `S.android.intent.extra.TEXT=${encodeURIComponent(safeText)};` +
    `S.android.intent.extra.SUBJECT=${encodeURIComponent(title)};end`;

  try {
    const anchor = document.createElement('a');
    anchor.href = intent;
    anchor.rel = 'noreferrer';
    anchor.style.cssText = 'position:fixed;width:0;height:0;left:-9999px;';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } catch {
    /* fall through */
  }

  try {
    window.location.href = intent;
  } catch {
    /* ignore */
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function guessMimeTypeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

/** Share PDF/file blob via Web Share files API (needs prefetched blob + user gesture). */
export async function shareAndroidFileNow(options: {
  blob: Blob;
  fileName: string;
  title?: string | null;
}): Promise<'shared' | 'aborted' | 'failed'> {
  if (typeof navigator.share !== 'function') {
    return 'failed';
  }

  try {
    const fileName = options.fileName.trim() || 'document';
    const title = options.title?.trim() || fileName;
    const mimeType = options.blob.type || guessMimeTypeFromFileName(fileName);
    const file = new File([options.blob], fileName, { type: mimeType });

    const payloads: ShareData[] = [
      { files: [file] },
      { files: [file], title },
      { files: [file], title, text: fileName },
    ];

    for (const payload of payloads) {
      try {
        await navigator.share(payload);
        return 'shared';
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          return 'aborted';
        }
      }
    }
  } catch (err) {
    console.warn('[Android Share] file share failed', err);
  }

  return 'failed';
}

export type AndroidLinkShareResult = 'shared' | 'copied' | 'failed';

/**
 * Share a download link on Android — must run immediately on tap.
 * Falls back to clipboard copy so the link is always accessible.
 */
export async function shareAndroidLinkNow(options: {
  url: string;
  fileName: string;
  title?: string | null;
}): Promise<AndroidLinkShareResult> {
  const url = options.url.trim();
  if (!url) return 'failed';

  const fileName = options.fileName.trim() || 'document';
  const title = options.title?.trim() || fileName;
  const shortLine = `Save or share this file: ${fileName}`;
  const body = `${shortLine}\n${url}`;

  try {
    const payloads: WebSharePayload[] = [
      { text: body },
      { title, text: shortLine, url },
      { title: fileName, url },
      { title, url },
    ];

    const shareResult = await invokeAndroidWebShare(payloads);
    if (shareResult === 'shared' || shareResult === 'aborted') {
      return 'shared';
    }
  } catch (err) {
    console.warn('[Android Share] web share failed', err);
  }

  try {
    triggerAndroidSendIntent(title, body.length > ANDROID_INTENT_TEXT_MAX ? `${shortLine}\n${url.slice(0, 2000)}…` : body);
    return 'shared';
  } catch (err) {
    console.warn('[Android Share] intent share failed', err);
  }

  if (await copyTextToClipboard(url)) {
    return 'copied';
  }

  return 'failed';
}
