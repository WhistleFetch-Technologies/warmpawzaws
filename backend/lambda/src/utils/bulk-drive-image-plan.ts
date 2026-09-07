/**
 * Decide what to persist on bulk save vs what to ingest asynchronously.
 * HTTP (non-Drive) URLs stay as-is. Drive folder/file cells persist lh3 display
 * URLs immediately (browser-loadable) while S3 ingest runs in the background.
 * drive.google.com/uc view URLs are never stored.
 */

import { isFragileProductImageUrl } from './product-ecommerce-validation';
import { extractDriveFileId, lh3DriveUrl } from './drive-file-download';
import { isManagedProductS3Image } from './product-s3-image';
import { normalizeImagesArray } from './product-sku-resolve';

export type BulkDriveImagePlan = {
  persistImages: string[];
  driveFileIds: string[];
  needsIngest: boolean;
};

export function isDriveHostedProductImageUrl(url: string): boolean {
  return extractDriveFileId(url) != null || isFragileProductImageUrl(url);
}

export function extractDriveFileIdsFromImageList(urls: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of normalizeImagesArray(urls)) {
    const id = extractDriveFileId(raw);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function ingestRecord(metadata: unknown): Record<string, unknown> | null {
  let raw = metadata;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const ingest = (raw as Record<string, unknown>).image_ingest;
  if (!ingest || typeof ingest !== 'object' || Array.isArray(ingest)) return null;
  return ingest as Record<string, unknown>;
}

export function extractDriveFileIdsFromIngestMetadata(metadata: unknown): string[] {
  const ingest = ingestRecord(metadata);
  if (!ingest) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of ['fileIds', 'pendingFileIds', 'failedFileIds'] as const) {
    const value = ingest[key];
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      const id = extractDriveFileId(String(item ?? ''));
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

/** File IDs from stored image URLs and/or leftover ingest metadata (empty-image recover). */
export function collectBackfillFileIds(images: unknown, metadata?: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of extractDriveFileIdsFromImageList(images)) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  for (const id of extractDriveFileIdsFromIngestMetadata(metadata)) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function lh3DisplayUrlsForFileIds(fileIds: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of fileIds) {
    const id = extractDriveFileId(String(raw ?? ''));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(lh3DriveUrl(id));
  }
  return out;
}

export function filterDisplayableProductImages(raw: unknown): string[] {
  return normalizeImagesArray(raw).filter((u) => !isFragileProductImageUrl(u));
}

/** Storefront/vendor cards: real photos now, lh3 from ingest metadata if save left images empty. */
export function resolveDisplayableProductImages(raw: unknown, metadata?: unknown): string[] {
  const shown = filterDisplayableProductImages(raw);
  if (shown.length > 0) return shown;
  return lh3DisplayUrlsForFileIds(extractDriveFileIdsFromIngestMetadata(metadata));
}

export function keptManagedS3Images(prev: unknown, vendorId: string): string[] {
  return normalizeImagesArray(prev).filter((u) => isManagedProductS3Image(u, vendorId));
}

/** Prefer existing S3; otherwise keep non-fragile display URLs (e.g. lh3). */
export function keepDisplayableProductImages(prev: unknown, vendorId: string): string[] {
  const s3 = keptManagedS3Images(prev, vendorId);
  if (s3.length > 0) return s3;
  return filterDisplayableProductImages(prev);
}

/** Split expanded bulk image URLs into persist-now vs Drive ingest. */
export function planBulkDriveImages(
  rawUrls: string[],
  prevImages: unknown,
  vendorId: string,
): BulkDriveImagePlan {
  const urls = rawUrls.map((u) => String(u ?? '').trim()).filter(Boolean);
  const driveFileIds = extractDriveFileIdsFromImageList(urls);
  const httpKeep = urls.filter((u) => /^https?:\/\//i.test(u) && !isDriveHostedProductImageUrl(u));

  if (driveFileIds.length === 0) {
    return { persistImages: httpKeep.length > 0 ? httpKeep : urls, driveFileIds: [], needsIngest: false };
  }

  const priorS3 = keptManagedS3Images(prevImages, vendorId);
  const persistImages =
    priorS3.length > 0 ? priorS3 : driveFileIds.map((id) => lh3DriveUrl(id));
  return { persistImages, driveFileIds, needsIngest: true };
}

export function buildImageIngestMetadata(
  currentMeta: Record<string, unknown>,
  plan: BulkDriveImagePlan,
  folderId?: string | null,
): Record<string, unknown> {
  if (!plan.needsIngest) {
    const next = { ...currentMeta };
    delete next.image_ingest;
    return next;
  }
  return {
    ...currentMeta,
    image_ingest: {
      status: 'processing',
      source: 'drive_folder',
      folderId: folderId || null,
      fileIds: plan.driveFileIds,
    },
  };
}

export function groupDriveIngestEnqueueJobs(
  vendorId: string,
  items: Array<{ productId: string; fileIds: string[]; folderId?: string | null }>,
): Array<{ vendorId: string; productIds: string[]; remainingFileIds: string[]; folderId: string | null }> {
  const byKey = new Map<
    string,
    { vendorId: string; productIds: string[]; remainingFileIds: string[]; folderId: string | null }
  >();
  for (const item of items) {
    const productId = String(item.productId ?? '').trim();
    const fileIds = [...new Set(item.fileIds.map((id) => String(id).trim()).filter(Boolean))];
    if (!productId || fileIds.length === 0) continue;
    const folderId = item.folderId ? String(item.folderId) : null;
    const key = folderId ? `folder::${folderId}` : `files::${fileIds.slice().sort().join(',')}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.productIds.includes(productId)) existing.productIds.push(productId);
      continue;
    }
    byKey.set(key, {
      vendorId,
      productIds: [productId],
      remainingFileIds: fileIds,
      folderId,
    });
  }
  return [...byKey.values()];
}

export function readImageIngestStatus(metadata: unknown): string | null {
  const ingest = ingestRecord(metadata);
  if (!ingest) return null;
  const status = String(ingest.status ?? '').trim();
  return status || null;
}
