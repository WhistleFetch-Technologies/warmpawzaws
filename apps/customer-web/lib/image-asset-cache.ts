/**
 * IndexedDB + in-memory LRU for static and (later) managed image blobs.
 * Keys are stable paths, not expiring presigned URLs.
 */

import { isDerivedThumbImageSrc } from './full-image-url-from-thumb';

const DB_NAME = 'warmpawz-image-cache-v1';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;
const MAX_ENTRIES = 120;
const MAX_BYTES = 50 * 1024 * 1024;

type CacheEntry = {
  key: string;
  blob: Blob;
  size: number;
  updatedAt: number;
};

const memoryLru = new Map<string, { blobUrl: string; size: number }>();
let memoryBytes = 0;
let dbPromise: Promise<IDBDatabase | null> | null = null;

export function isStaticLocalImageSrc(src: string | null | undefined): boolean {
  if (!src) return false;
  const trimmed = src.trim();
  return trimmed.startsWith('/') && !trimmed.includes('amazonaws.com');
}

/** Extract S3 / media-CDN object key from a URL or bare key for managed media. */
export function extractS3ImageKey(src: string): string | null {
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return null;
  if (isStaticLocalImageSrc(trimmed)) return null;

  const looksManagedHost =
    trimmed.includes('amazonaws.com') ||
    /\.cloudfront\.net\//i.test(trimmed) ||
    /\/\/media\.warmpawz\.com\//i.test(trimmed);

  if (!looksManagedHost) {
    const bare = trimmed.replace(/^\/+/, '');
    if (bare.startsWith('vendors/') || bare.startsWith('media/')) {
      return bare;
    }
    if (
      !trimmed.startsWith('/') &&
      /\.(webp|jpe?g|png|gif)(\?|$)/i.test(trimmed) &&
      !trimmed.startsWith('http')
    ) {
      return bare;
    }
    return null;
  }
  try {
    const u = new URL(trimmed);
    const key = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    return key || null;
  } catch {
    return null;
  }
}

export function cacheKeyForImageSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith('blob:')) return null;

  if (isStaticLocalImageSrc(trimmed)) {
    const path = trimmed.split('?')[0].split('#')[0];
    return `static:${path}`;
  }

  const s3Key = extractS3ImageKey(trimmed);
  if (s3Key) return `s3:${s3Key}`;

  // Do not IndexedDB-cache arbitrary third-party URLs (unbounded / unstable).
  return null;
}

/** Static paths and managed S3/CDN keys are safe to persist in IndexedDB. */
export function isIndexedDbCacheableImageSrc(src: string | null | undefined): boolean {
  const key = cacheKeyForImageSrc(src);
  return Boolean(key && (key.startsWith('static:') || key.startsWith('s3:')));
}

/** Bare object key that GET /storage/refresh-url can sign. */
export function isManagedVendorMediaKey(src: string | null | undefined): boolean {
  const t = String(src ?? '').trim();
  if (
    !t ||
    /^https?:\/\//i.test(t) ||
    t.startsWith('//') ||
    t.startsWith('/') ||
    t.startsWith('data:') ||
    t.startsWith('blob:') ||
    isStaticLocalImageSrc(t)
  ) {
    return false;
  }
  return Boolean(extractS3ImageKey(t));
}

/** Expired S3/CDN URL or bare managed key — refresh-url can mint a signed src. */
export function isRefreshableManagedImageSrc(src: string | null | undefined): boolean {
  const t = String(src ?? '').trim();
  if (!t) return false;
  if (t.includes('amazonaws.com') || /\.cloudfront\.net\//i.test(t) || /media\.warmpawz\.com\//i.test(t)) {
    return true;
  }
  return isManagedVendorMediaKey(t);
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }
  return dbPromise;
}

function evictMemoryIfNeeded(incomingSize: number): void {
  while (
    memoryLru.size >= MAX_ENTRIES ||
    (memoryBytes + incomingSize > MAX_BYTES && memoryLru.size > 0)
  ) {
    const oldestKey = memoryLru.keys().next().value;
    if (!oldestKey) break;
    const entry = memoryLru.get(oldestKey);
    if (entry) {
      URL.revokeObjectURL(entry.blobUrl);
      memoryBytes -= entry.size;
    }
    memoryLru.delete(oldestKey);
  }
}

async function readFromDb(cacheKey: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(cacheKey);
    req.onsuccess = () => {
      const row = req.result as CacheEntry | undefined;
      resolve(row?.blob ?? null);
    };
    req.onerror = () => resolve(null);
  });
}

async function writeToDb(cacheKey: string, blob: Blob): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const entry: CacheEntry = {
      key: cacheKey,
      blob,
      size: blob.size,
      updatedAt: Date.now(),
    };
    store.put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function getCachedImageBlobUrl(
  src: string | null | undefined
): Promise<string | null> {
  const cacheKey = cacheKeyForImageSrc(src);
  if (!cacheKey) return null;

  const mem = memoryLru.get(cacheKey);
  if (mem) {
    memoryLru.delete(cacheKey);
    memoryLru.set(cacheKey, mem);
    return mem.blobUrl;
  }

  const blob = await readFromDb(cacheKey);
  if (!blob) return null;

  const blobUrl = URL.createObjectURL(blob);
  evictMemoryIfNeeded(blob.size);
  memoryLru.set(cacheKey, { blobUrl, size: blob.size });
  memoryBytes += blob.size;
  return blobUrl;
}

export async function fetchAndCacheImageSrc(
  src: string,
  init?: RequestInit
): Promise<string | null> {
  if (isDerivedThumbImageSrc(src)) return null;
  const cacheKey = cacheKeyForImageSrc(src);
  if (!cacheKey) return null;

  const existing = await getCachedImageBlobUrl(src);
  if (existing) return existing;

  try {
    const credentials =
      init?.credentials ??
      (isStaticLocalImageSrc(src) ? 'same-origin' : 'omit');
    const res = await fetch(src, { ...init, credentials, mode: init?.mode ?? 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;

    await writeToDb(cacheKey, blob);
    const blobUrl = URL.createObjectURL(blob);
    evictMemoryIfNeeded(blob.size);
    memoryLru.set(cacheKey, { blobUrl, size: blob.size });
    memoryBytes += blob.size;
    return blobUrl;
  } catch {
    return null;
  }
}

/** Pre-warm static paths on idle (no-op on SSR). Skips paths already in IDB. */
export async function prewarmStaticImagePaths(paths: string[]): Promise<void> {
  if (typeof window === 'undefined') return;
  const unique = [...new Set(paths.filter((p) => isStaticLocalImageSrc(p)))];
  for (const path of unique) {
    try {
      const existing = await getCachedImageBlobUrl(path);
      if (existing) continue;
      await fetchAndCacheImageSrc(path);
      // Yield so hub navigations are not starved by a long prewarm train.
      await new Promise((r) => globalThis.setTimeout(r, 120));
    } catch {
      // best-effort
    }
  }
}

export function scheduleStaticImagePrewarm(paths: string[]): void {
  if (typeof window === 'undefined' || paths.length === 0) return;
  const run = () => {
    void prewarmStaticImagePaths(paths);
  };
  // Late idle: prefer first paint / service hub images over background warm.
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 12000 });
  } else {
    globalThis.setTimeout(run, 4000);
  }
}
