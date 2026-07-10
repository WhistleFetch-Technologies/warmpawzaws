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
import { validateImageBuffer } from './image-validator';
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

  // Do not gate on metadata() alone — phone JPEGs often fail failOn:error metadata but encode fine.
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
    processed = await processImageBuffer(buffer, assetType, basic.detectedMime);
  } catch (err: unknown) {
    const sharpMsg = (err as Error)?.message || 'processing_failed';
    console.warn(
      JSON.stringify({
        event: 'image.upload.process_failed',
        assetType,
        byteLength: buffer.length,
        declaredContentType: input.declaredContentType,
        detectedMime: basic.detectedMime,
        error: sharpMsg,
      }),
    );
    const userMessage =
      /heif|heic/i.test(sharpMsg) || basic.detectedMime === 'image/heic'
        ? 'HEIC/HEIF is not supported on the server. Please upload JPEG or PNG.'
        : 'Failed to process image. Try a JPEG or PNG from your gallery.';
    await recordImageUploadFailed(assetType, userMessage);
    throw new ImageProcessingError(userMessage, 400);
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
