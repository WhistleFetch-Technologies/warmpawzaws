/**
 * Lazy legacy migration: convert non-WebP S3 keys on read (sync, inline).
 */

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { query } from '../../database/rds-connection';
import type { AssetType, ImageDto } from './image-types';
import {
  buildDisplayWebpKey,
  buildLegacyKey,
  buildThumbWebpKey,
  isWebpKey,
} from './image-key-builder';
import { processImageBuffer } from './image-processor';
import { detectImageMime, validateImageBuffer } from './image-validator';
import { putWebpObject, getUploadsBucket } from './image-repository';
import { attachUrlsToImageDto } from './image-url-builder';
import { assetTypeNeedsThumb } from './image-types';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

function normalizeToS3Key(raw: string, bucket: string): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s.startsWith('data:')) return null;
  if (!s.includes('://')) return s.replace(/^\/+/, '');
  try {
    const u = new URL(s.split('?')[0]);
    const hostMatch = u.hostname.match(/^([^.]+)\.s3[./]/);
    if (hostMatch) {
      return decodeURIComponent(u.pathname.replace(/^\//, ''));
    }
  } catch {
    return null;
  }
  return null;
}

export async function logLegacyMigration(legacyKey: string, webpKey: string): Promise<void> {
  try {
    await query(
      `INSERT INTO image_migration_log (legacy_key, webp_key) VALUES ($1, $2) ON CONFLICT (legacy_key) DO NOTHING`,
      [legacyKey, webpKey],
    );
  } catch {
    // Table may not exist until migration runs
  }
}

export async function ensureWebpFromLegacy(
  raw: string | null | undefined,
  assetType: AssetType,
  ownerId: string,
  vendorId?: string,
): Promise<ImageDto | null> {
  if (!raw) return null;
  const bucket = getUploadsBucket();
  const key = normalizeToS3Key(raw, bucket);
  if (!key) return null;
  if (isWebpKey(key)) {
    const thumbKey = assetTypeNeedsThumb(assetType) ? buildThumbWebpKey(key) : null;
    return attachUrlsToImageDto({
      imageKey: key,
      thumbKey,
      width: 0,
      height: 0,
      thumbWidth: null,
      thumbHeight: null,
      size: 0,
      thumbSize: null,
      contentType: 'image/webp',
    });
  }

  const started = Date.now();
  try {
    const obj = await s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const bytes = await obj.Body?.transformToByteArray();
    if (!bytes || bytes.length === 0) return null;
    const buffer = Buffer.from(bytes);

    const validation = validateImageBuffer(buffer);
    if (!validation.ok) return null;

    const processed = await processImageBuffer(buffer, assetType, validation.detectedMime);
    const displayKey = buildDisplayWebpKey({
      assetType,
      ownerId,
      vendorId,
    });
    const thumbKey =
      processed.thumb && assetTypeNeedsThumb(assetType)
        ? buildThumbWebpKey(displayKey)
        : null;

    await putWebpObject(displayKey, processed.display.buffer, bucket);
    if (processed.thumb && thumbKey) {
      await putWebpObject(thumbKey, processed.thumb.buffer, bucket);
    }

    const legacyDest = buildLegacyKey(key);
    try {
      await putWebpObject(legacyDest, buffer, bucket);
    } catch {
      // best-effort legacy retention
    }

    await logLegacyMigration(key, displayKey);

    console.log(
      JSON.stringify({
        event: 'image.legacy.migrated',
        legacyKey: key,
        webpKey: displayKey,
        processingMs: Date.now() - started,
      }),
    );

    return attachUrlsToImageDto({
      imageKey: displayKey,
      thumbKey,
      width: processed.display.width,
      height: processed.display.height,
      thumbWidth: processed.thumb?.width ?? null,
      thumbHeight: processed.thumb?.height ?? null,
      size: processed.display.byteSize,
      thumbSize: processed.thumb?.byteSize ?? null,
      contentType: 'image/webp',
    });
  } catch (err: unknown) {
    console.warn('[image-migrator] ensureWebpFromLegacy failed:', (err as Error)?.message || err);
    return null;
  }
}
