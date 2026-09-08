/**
 * Hold products out of admin approval until catalog images are live.
 * Do not reuse draft — stock-zero already owns that status.
 */

import {
  extractDriveFileIdsFromImageList,
  filterDisplayableProductImages,
  keptManagedS3Images,
  readImageIngestStatus,
} from './bulk-drive-image-plan';

export const IMAGE_APPROVAL_HOLD = 'images';
export const MAX_IMAGE_INGEST_ATTEMPTS = 5;

export const SQL_EXCLUDE_IMAGE_APPROVAL_HOLD =
  "COALESCE(metadata->>'approval_hold', '') IS DISTINCT FROM 'images'";

export const SQL_EXCLUDE_PRODUCT_IMAGE_APPROVAL_HOLD =
  "COALESCE(p.metadata->>'approval_hold', '') IS DISTINCT FROM 'images'";

export function readApprovalHold(metadata: unknown): string | null {
  const meta = asMeta(metadata);
  if (!meta) return null;
  const hold = String(meta.approval_hold ?? '').trim();
  return hold || null;
}

export function withImageApprovalHold(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  return { ...metadata, approval_hold: IMAGE_APPROVAL_HOLD };
}

export function clearImageApprovalHold(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...metadata };
  delete next.approval_hold;
  return next;
}

export function isProductImageReady(
  images: unknown,
  metadata?: unknown,
  vendorId?: string,
): boolean {
  const ingest = readImageIngestStatus(metadata);
  if (ingest === 'processing' || ingest === 'failed') return false;

  const managed = keptManagedS3Images(images, vendorId ?? '');
  if (managed.length > 0) return true;

  if (!ingest) {
    const displayable = filterDisplayableProductImages(images);
    return displayable.length > 0 && extractDriveFileIdsFromImageList(images).length === 0;
  }
  return false;
}

export function applyImageApprovalHold(
  metadata: Record<string, unknown>,
  images: unknown,
  vendorId?: string,
): Record<string, unknown> {
  const withFailed = markFailedIngestIfUnverified(metadata, images, vendorId);
  if (isProductImageReady(images, withFailed, vendorId)) {
    return clearImageApprovalHold(withFailed);
  }
  return withImageApprovalHold(withFailed);
}

function markFailedIngestIfUnverified(
  metadata: Record<string, unknown>,
  images: unknown,
  vendorId?: string,
): Record<string, unknown> {
  if (isProductImageReady(images, metadata, vendorId)) return metadata;
  if (readImageIngestStatus(metadata)) return metadata;
  const driveIds = extractDriveFileIdsFromImageList(images);
  if (driveIds.length === 0) return metadata;
  return {
    ...metadata,
    image_ingest: {
      status: 'failed',
      source: 'external_url',
      fileIds: driveIds,
      failedFileIds: driveIds,
      attempt: 1,
      next_retry_at: nextImageIngestRetryAt(1),
    },
  };
}

export function readImageIngestAttempt(metadata: unknown): number {
  const ingest = ingestRecord(metadata);
  if (!ingest) return 0;
  const n = Number(ingest.attempt ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function shouldRetryImageIngest(metadata: unknown, now = Date.now()): boolean {
  const ingest = readImageIngestStatus(metadata);
  if (ingest !== 'failed' && ingest !== 'processing') return false;
  if (readApprovalHold(metadata) !== IMAGE_APPROVAL_HOLD && ingest !== 'failed') {
    if (ingest !== 'processing') return false;
  }
  const attempt = readImageIngestAttempt(metadata);
  if (attempt >= MAX_IMAGE_INGEST_ATTEMPTS) return false;
  const nextAt = ingestRecord(metadata)?.next_retry_at;
  if (!nextAt) return true;
  const ts = Date.parse(String(nextAt));
  if (!Number.isFinite(ts)) return true;
  return ts <= now;
}

export function nextImageIngestRetryAt(attempt: number, now = Date.now()): string {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const delayMs = Math.min(15 * 60 * 1000, 60_000 * safeAttempt);
  return new Date(now + delayMs).toISOString();
}

function asMeta(metadata: unknown): Record<string, unknown> | null {
  let raw = metadata;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function ingestRecord(metadata: unknown): Record<string, unknown> | null {
  const meta = asMeta(metadata);
  if (!meta) return null;
  const ingest = meta.image_ingest;
  if (!ingest || typeof ingest !== 'object' || Array.isArray(ingest)) return null;
  return ingest as Record<string, unknown>;
}
