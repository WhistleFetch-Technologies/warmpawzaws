'use client';

import { isAndroidMobileContext } from '@/lib/android-attachment-share';
import {
  isCapacitorShareAvailable,
  stageNativeShareFile,
  type StagedNativeShareFile,
} from '@/lib/capacitor-pdf-save';
import { getAuthHeaders, resolveApiUrl } from '@/lib/download-file';

export type AttachmentCacheInput = {
  fileUrl?: string | null;
  fileId?: string | null;
  fileName?: string | null;
};

export type AttachmentPrepareState = 'loading' | 'native_ready' | 'failed';

function cacheKey(input: AttachmentCacheInput): string | null {
  const id = input.fileId?.trim();
  if (id) return `id:${id}`;
  const url = input.fileUrl?.trim();
  if (url) return `url:${url}`;
  return null;
}

function resolveFileName(input: AttachmentCacheInput): string {
  const explicit = input.fileName?.trim();
  if (explicit) return explicit;

  const fileId = input.fileId?.trim();
  if (fileId) {
    const segment = fileId.split('/').pop();
    if (segment) return segment;
  }

  const fileUrl = input.fileUrl?.trim();
  if (fileUrl) {
    try {
      const pathname = new URL(fileUrl).pathname;
      const segment = pathname.split('/').pop();
      if (segment) return decodeURIComponent(segment);
    } catch {
      /* ignore */
    }
  }

  return 'document';
}

const inflight = new Map<string, Promise<Blob>>();
const ready = new Map<string, Blob>();
const readyNativeUri = new Map<string, StagedNativeShareFile>();
const nativeStagingInflight = new Map<string, Promise<StagedNativeShareFile | null>>();
const failedNativeKeys = new Set<string>();

function chatFileApiPath(fileId: string): string {
  return `/chat/file/${fileId.split('/').map(encodeURIComponent).join('/')}`;
}

async function fetchAttachmentBlob(input: AttachmentCacheInput): Promise<Blob> {
  const fileId = input.fileId?.trim();
  const fileUrl = input.fileUrl?.trim();
  let fileUrlError: unknown;

  // Prefer authenticated API stream over expiring presigned S3 URL.
  if (fileId) {
    const url = resolveApiUrl(chatFileApiPath(fileId));
    const response = await fetch(url, { headers: getAuthHeaders() });
    if (response.ok) {
      const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        const json = await response.json();
        const presigned = json.downloadUrl ?? json.download_url;
        if (presigned && typeof presigned === 'string') {
          const fileResponse = await fetch(presigned);
          if (fileResponse.ok) {
            return fileResponse.blob();
          }
        }
      } else {
        return response.blob();
      }
    }
  }

  if (fileUrl) {
    try {
      const response = await fetch(fileUrl);
      if (response.ok) {
        return response.blob();
      }
    } catch (err) {
      fileUrlError = err;
    }
  }

  if (fileUrlError) {
    throw fileUrlError;
  }

  throw new Error('No file available');
}

function startNativeStaging(key: string, blob: Blob, fileName: string): void {
  if (!isAndroidMobileContext()) return;
  if (readyNativeUri.has(key) || nativeStagingInflight.has(key)) return;

  if (!isCapacitorShareAvailable()) {
    failedNativeKeys.add(key);
    return;
  }

  const promise = stageNativeShareFile(blob, fileName)
    .then((staged) => {
      if (staged) {
        readyNativeUri.set(key, staged);
        failedNativeKeys.delete(key);
      } else {
        failedNativeKeys.add(key);
      }
      return staged;
    })
    .catch((err) => {
      failedNativeKeys.add(key);
      if (process.env.NODE_ENV === 'development') {
        console.warn('[chat-attachment-cache] native staging failed', err);
      }
      return null;
    })
    .finally(() => {
      nativeStagingInflight.delete(key);
    });

  nativeStagingInflight.set(key, promise);
}

function afterBlobReady(key: string, blob: Blob, input: AttachmentCacheInput): void {
  startNativeStaging(key, blob, resolveFileName(input));
}

/** Warm cache when attachment appears in chat (before user taps Save or share). */
export function prefetchChatAttachmentBlob(input: AttachmentCacheInput): void {
  const key = cacheKey(input);
  if (!key) return;

  if (ready.has(key)) {
    if (
      isAndroidMobileContext() &&
      !readyNativeUri.has(key) &&
      !nativeStagingInflight.has(key) &&
      !failedNativeKeys.has(key)
    ) {
      afterBlobReady(key, ready.get(key)!, input);
    }
    return;
  }

  if (inflight.has(key)) return;

  const promise = fetchAttachmentBlob(input)
    .then((blob) => {
      ready.set(key, blob);
      afterBlobReady(key, blob, input);
      return blob;
    })
    .catch((err) => {
      inflight.delete(key);
      failedNativeKeys.add(key);
      if (process.env.NODE_ENV === 'development') {
        console.warn('[chat-attachment-cache] prefetch failed', err);
      }
      throw err;
    });

  inflight.set(key, promise);
}

export async function getChatAttachmentBlob(input: AttachmentCacheInput): Promise<Blob | null> {
  const key = cacheKey(input);
  if (!key) return null;

  const cached = ready.get(key);
  if (cached) return cached;

  if (!inflight.has(key)) {
    prefetchChatAttachmentBlob(input);
  }

  try {
    return await inflight.get(key)!;
  } catch {
    return null;
  }
}

export function isChatAttachmentBlobReady(input: AttachmentCacheInput): boolean {
  const key = cacheKey(input);
  return key ? ready.has(key) : false;
}

export function isNativeShareReady(input: AttachmentCacheInput): boolean {
  const key = cacheKey(input);
  return key ? readyNativeUri.has(key) : false;
}

export function getNativeShareUri(input: AttachmentCacheInput): StagedNativeShareFile | null {
  const key = cacheKey(input);
  if (!key) return null;
  return readyNativeUri.get(key) ?? null;
}

export function getAttachmentPrepareState(input: AttachmentCacheInput): AttachmentPrepareState {
  if (!isAndroidMobileContext()) {
    return isChatAttachmentBlobReady(input) ? 'native_ready' : 'loading';
  }

  const key = cacheKey(input);
  if (!key) return 'failed';

  if (readyNativeUri.has(key)) {
    return 'native_ready';
  }

  if (failedNativeKeys.has(key) && !inflight.has(key) && !nativeStagingInflight.has(key)) {
    return 'failed';
  }

  return 'loading';
}

/** Wait for native URI staging (used when blob is ready but staging still running). */
export async function waitForNativeShareReady(
  input: AttachmentCacheInput,
  timeoutMs = 15000
): Promise<StagedNativeShareFile | null> {
  const cached = getNativeShareUri(input);
  if (cached) return cached;

  const key = cacheKey(input);
  if (!key) return null;

  if (!ready.has(key) && !inflight.has(key)) {
    prefetchChatAttachmentBlob(input);
  }

  const blob = await waitForChatAttachmentBlob(input, timeoutMs);
  if (!blob) return null;

  if (!nativeStagingInflight.has(key) && !readyNativeUri.has(key)) {
    startNativeStaging(key, blob, resolveFileName(input));
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const staged = getNativeShareUri(input);
    if (staged) return staged;

    const inflightStage = nativeStagingInflight.get(key);
    if (inflightStage) {
      const result = await Promise.race([
        inflightStage,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 200)),
      ]);
      if (result) return result;
      continue;
    }

    if (failedNativeKeys.has(key)) {
      return null;
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return getNativeShareUri(input);
}

export async function waitForChatAttachmentBlob(
  input: AttachmentCacheInput,
  timeoutMs = 12000
): Promise<Blob | null> {
  const cached = await getChatAttachmentBlob(input);
  if (cached) return cached;

  prefetchChatAttachmentBlob(input);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (isChatAttachmentBlobReady(input)) {
      return getChatAttachmentBlob(input);
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return getChatAttachmentBlob(input);
}
