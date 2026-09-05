/**
 * Decide what to persist on bulk save vs what to ingest asynchronously.
 * HTTP (non-Drive) URLs stay as-is. Drive file/folder URLs never hit products.images.
 */

import { isFragileProductImageUrl } from './product-ecommerce-validation';
import { extractDriveFileId } from './drive-file-download';
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

export function filterDisplayableProductImages(raw: unknown): string[] {
  return normalizeImagesArray(raw).filter((u) => !isFragileProductImageUrl(u));
}

export function keptManagedS3Images(prev: unknown, vendorId: string): string[] {
  return normalizeImagesArray(prev).filter((u) => isManagedProductS3Image(u, vendorId));
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

  // Keep previous S3 until the worker swaps — never persist Drive view URLs.
  const persistImages = keptManagedS3Images(prevImages, vendorId);
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
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const ingest = (metadata as Record<string, unknown>).image_ingest;
  if (!ingest || typeof ingest !== 'object' || Array.isArray(ingest)) return null;
  const status = String((ingest as Record<string, unknown>).status ?? '').trim();
  return status || null;
}
