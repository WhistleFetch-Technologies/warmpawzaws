/**
 * List image files in a Google Drive folder via whitelisted HTML endpoints only.
 * Never fetch arbitrary user-supplied URLs — only construct requests from folderId.
 */

import https from 'https';
import { PRODUCT_MAX_IMAGES } from '../services/image/image-types';

const FOLDER_TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 5;
const DEFAULT_CONCURRENCY = 6;

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)$/i;

export type DriveFolderEntry = { fileId: string; filename: string };

export type DriveFolderListResult =
  | { ok: true; urls: string[]; truncated: boolean }
  | { ok: false; message: string };

type FetchResult = { status: number; body: Buffer };

function isValidFolderId(folderId: string): boolean {
  return /^[A-Za-z0-9_-]{10,}$/.test(folderId);
}

function driveFileViewUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

function embeddedFolderUrl(folderId: string): string {
  return `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`;
}

function folderPageUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;
}

function fetchFollow(url: string, redirectsLeft = MAX_REDIRECTS): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    if (redirectsLeft < 0) {
      reject(new Error('Too many redirects'));
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error('Invalid URL'));
      return;
    }
    if (parsed.hostname !== 'drive.google.com') {
      reject(new Error('Host not allowed'));
      return;
    }
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,*/*',
        },
        timeout: FOLDER_TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          resolve(fetchFollow(next, redirectsLeft - 1));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (d: Buffer) => chunks.push(d));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) }),
        );
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

/**
 * Parse Drive folder HTML into structured { fileId, filename } entries.
 * Prefer entries that include a filename (embeddedfolderview); fall back to id-only.
 */
export function parseDriveFolderEntries(html: string, folderId: string): DriveFolderEntry[] {
  const byId = new Map<string, string>();

  const add = (fileId: string, filename: string) => {
    if (!fileId || fileId === folderId || fileId.length < 20) return;
    const prev = byId.get(fileId);
    if (!prev || (!prev && filename) || (filename && filename.length > (prev?.length ?? 0))) {
      byId.set(fileId, filename || prev || '');
    }
  };

  // embeddedfolderview: <a href=".../file/d/ID/...">filename</a> patterns
  for (const m of html.matchAll(
    /\/file\/d\/(1[A-Za-z0-9_-]{20,})[^"'<\s]*["'][^>]*>([^<]{1,200})</gi,
  )) {
    add(m[1], String(m[2] ?? '').trim());
  }
  for (const m of html.matchAll(
    /href="https:\/\/drive\.google\.com\/file\/d\/(1[A-Za-z0-9_-]{20,})[^"]*"[^>]*>([^<]{1,200})</gi,
  )) {
    add(m[1], String(m[2] ?? '').trim());
  }

  // data-id with nearby title attributes
  for (const m of html.matchAll(
    /data-id="(1[A-Za-z0-9_-]{20,})"[^>]*(?:aria-label|data-tooltip|title)="([^"]{1,200})"/gi,
  )) {
    add(m[1], String(m[2] ?? '').trim());
  }
  for (const m of html.matchAll(
    /(?:aria-label|data-tooltip|title)="([^"]{1,200})"[^>]*data-id="(1[A-Za-z0-9_-]{20,})"/gi,
  )) {
    add(m[2], String(m[1] ?? '').trim());
  }

  // id-only fallbacks from folder page
  for (const m of html.matchAll(/data-id="(1[A-Za-z0-9_-]{20,})"/g)) add(m[1], '');
  for (const m of html.matchAll(/\/file\/d\/(1[A-Za-z0-9_-]{20,})/g)) add(m[1], '');
  for (const m of html.matchAll(/googleusercontent\.com\/d\/(1[A-Za-z0-9_-]{20,})/g)) add(m[1], '');
  for (const m of html.matchAll(/thumbnail\?id=(1[A-Za-z0-9_-]{20,})/g)) add(m[1], '');

  return [...byId.entries()].map(([fileId, filename]) => ({ fileId, filename }));
}

export function filterSortCapDriveEntries(
  entries: DriveFolderEntry[],
  maxImages = PRODUCT_MAX_IMAGES,
): { kept: DriveFolderEntry[]; truncated: boolean } {
  const images = entries.filter((e) => {
    const name = e.filename || '';
    // Prefer entries with image extensions; if no filename, keep for id-only fallback lists
    if (name) return IMAGE_EXT_RE.test(name);
    return true;
  });

  // If any named images exist, drop id-only entries (unknown type)
  const named = images.filter((e) => e.filename && IMAGE_EXT_RE.test(e.filename));
  const pool = named.length > 0 ? named : images.filter((e) => !e.filename);

  pool.sort((a, b) => {
    const fa = (a.filename || a.fileId).toLowerCase();
    const fb = (b.filename || b.fileId).toLowerCase();
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  });

  const truncated = pool.length > maxImages;
  return { kept: pool.slice(0, maxImages), truncated };
}

async function listFolderOnce(folderId: string): Promise<DriveFolderListResult> {
  if (!isValidFolderId(folderId)) {
    return {
      ok: false,
      message:
        'Could not read images from this Drive folder. Share the folder as Anyone with the link (Viewer), put only this product’s photos in it, or paste comma-separated file URLs.',
    };
  }

  const failMsg =
    'Could not read images from this Drive folder. Share the folder as Anyone with the link (Viewer), put only this product’s photos in it, or paste comma-separated file URLs.';

  let entries: DriveFolderEntry[] = [];

  try {
    const embedded = await fetchFollow(embeddedFolderUrl(folderId));
    if (embedded.status >= 200 && embedded.status < 400) {
      entries = parseDriveFolderEntries(embedded.body.toString('utf8'), folderId);
    }
  } catch {
    // try fallback
  }

  if (entries.length === 0) {
    try {
      const page = await fetchFollow(folderPageUrl(folderId));
      if (page.status >= 200 && page.status < 400) {
        entries = parseDriveFolderEntries(page.body.toString('utf8'), folderId);
      }
    } catch {
      return { ok: false, message: failMsg };
    }
  }

  if (entries.length === 0) {
    return { ok: false, message: failMsg };
  }

  const { kept, truncated } = filterSortCapDriveEntries(entries);
  // Require at least one supported image when filenames are present
  const withExt = kept.filter((e) => e.filename && IMAGE_EXT_RE.test(e.filename));
  const finalKept = withExt.length > 0 ? withExt : kept.filter((e) => !e.filename);

  if (finalKept.length === 0) {
    return { ok: false, message: failMsg };
  }

  const urls = finalKept.map((e) => driveFileViewUrl(e.fileId));
  return { ok: true, urls, truncated };
}

export type DriveFolderListCache = Map<string, Promise<DriveFolderListResult>>;

export function createDriveFolderListCache(): DriveFolderListCache {
  return new Map();
}

/**
 * List folder images with request-scoped Promise cache (success + in-flight).
 */
export function listDriveFolderImages(
  folderId: string,
  cache: DriveFolderListCache,
): Promise<DriveFolderListResult> {
  const existing = cache.get(folderId);
  if (existing) return existing;
  const p = listFolderOnce(folderId);
  cache.set(folderId, p);
  return p;
}

/** Run async work over items with a concurrency limit. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, concurrency);
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export const DRIVE_FOLDER_FETCH_CONCURRENCY = DEFAULT_CONCURRENCY;
