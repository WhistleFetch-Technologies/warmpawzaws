/**
 * Lean Asset Pipeline — orchestrates validate, dedup, encode, store, and URL attachment.
 */

import type { AssetType, ImageDto, ImageUploadInput } from './image-types';
import { assetTypeNeedsThumb } from './image-types';
import {
  buildDisplayWebpKey,
  buildThumbWebpKey,
  buildVendorProfileWebpKey,
} from './image-key-builder';
import {
  insertDedupEntry,
  lookupDedupEntry,
  sha256Hex,
  shouldDedup,
} from './image-content-index';
import { recordImageUploadFailed, recordImageUploadSuccess } from './image-metrics';
import { processImageBuffer } from './image-processor';
import { moveKeyToCleanup, putWebpObject, getUploadsBucket } from './image-repository';
import {
  validateImageBuffer,
  validateImageDimensions,
} from './image-validator';
import { attachUrlsToImageDto } from './image-url-builder';

export class ImageProcessingError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ImageProcessingError';
  }
}

function resolveDisplayKey(input: ImageUploadInput, suffix: string): string {
  if (input.assetType === 'profile' && input.vendorId) {
    return buildVendorProfileWebpKey(input.vendorId, suffix);
  }
  return buildDisplayWebpKey({
    assetType: input.assetType,
    ownerId: input.ownerId,
    vendorId: input.vendorId,
    bannerId: input.bannerId,
    suffix,
  });
}

export async function uploadDisplayImage(input: ImageUploadInput): Promise<ImageDto> {
  const started = Date.now();
  const { buffer, assetType } = input;

  const basic = validateImageBuffer(buffer, input.declaredContentType);
  if (!basic.ok) {
    await recordImageUploadFailed(assetType, basic.message);
    throw new ImageProcessingError(basic.message);
  }

  const dimCheck = await validateImageDimensions(buffer);
  if (!dimCheck.ok) {
    await recordImageUploadFailed(assetType, dimCheck.message);
    throw new ImageProcessingError(dimCheck.message);
  }

  const hash = sha256Hex(buffer);
  let dedupHit = false;

  if (shouldDedup(assetType)) {
    const existing = await lookupDedupEntry(hash);
    if (existing) {
      dedupHit = true;
      const dto = await attachUrlsToImageDto({
        imageKey: existing.webpKey,
        thumbKey: existing.thumbKey,
        width: 0,
        height: 0,
        thumbWidth: null,
        thumbHeight: null,
        size: 0,
        thumbSize: null,
        contentType: 'image/webp',
        dedupHit: true,
      });
      await recordImageUploadSuccess(assetType, {
        originalBytes: buffer.length,
        finalBytes: 0,
        processingMs: Date.now() - started,
        dedupHit: true,
      });
      if (input.previousImageKey) {
        await moveKeyToCleanup(input.previousImageKey);
      }
      return dto;
    }
  }

  let processed;
  try {
    processed = await processImageBuffer(buffer, assetType, dimCheck.detectedMime);
  } catch {
    await recordImageUploadFailed(assetType, 'processing_failed');
    throw new ImageProcessingError('Failed to process image', 500);
  }

  const suffix = `${Date.now().toString(36)}${hash.slice(0, 8)}`;
  const displayKey = resolveDisplayKey(input, suffix);
  const thumbKey =
    processed.thumb && assetTypeNeedsThumb(assetType) ? buildThumbWebpKey(displayKey) : null;

  const bucket = getUploadsBucket();
  await putWebpObject(displayKey, processed.display.buffer, bucket);
  if (processed.thumb && thumbKey) {
    await putWebpObject(thumbKey, processed.thumb.buffer, bucket);
  }

  if (shouldDedup(assetType)) {
    await insertDedupEntry({
      sha256: hash,
      webpKey: displayKey,
      thumbKey,
      byteSize: processed.display.byteSize,
    });
  }

  if (input.previousImageKey) {
    await moveKeyToCleanup(input.previousImageKey);
  }

  await recordImageUploadSuccess(assetType, {
    originalBytes: processed.originalBytes,
    finalBytes: processed.display.byteSize,
    processingMs: Date.now() - started,
    dedupHit,
  });

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
    dedupHit,
  });
}

export function toUploadJsonResponse(asset: ImageDto) {
  return {
    success: true,
    asset,
    imageKey: asset.imageKey,
    thumbKey: asset.thumbKey,
    width: asset.width,
    height: asset.height,
    size: asset.size,
    contentType: asset.contentType,
    url: asset.url,
    thumbUrl: asset.thumbUrl,
    // Backward compatibility for existing clients
    fileName: asset.imageKey,
    key: asset.imageKey,
    publicUrl: asset.url,
  };
}

export type { AssetType, ImageDto, ImageUploadInput };
