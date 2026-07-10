/**
 * Sharp-based WebP encoding with byte-budget targets.
 */

import type { AssetType, ProcessedImageResult, ProcessedVariant } from './image-types';
import { BYTE_BUDGETS, MAX_IMAGE_DIMENSION, assetTypeNeedsThumb } from './image-types';

const QUALITY_START = 0.85;
const QUALITY_MIN = 0.35;
const QUALITY_STEP = 0.08;

async function getSharp() {
  return (await import('sharp')).default;
}

async function encodeWebpToBudget(
  input: Buffer,
  targetBytes: number,
  maxEdgePx: number,
): Promise<ProcessedVariant> {
  const sharp = await getSharp();
  const rotated = sharp(input, { failOn: 'warning' }).rotate();
  const meta = await rotated.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w <= 0 || h <= 0) {
    throw new Error('Could not read image dimensions');
  }
  if (w > MAX_IMAGE_DIMENSION || h > MAX_IMAGE_DIMENSION) {
    throw new Error(
      `Image dimensions must be ${MAX_IMAGE_DIMENSION}px or smaller per edge`,
    );
  }
  const longest = Math.max(w, h);

  let quality = QUALITY_START;
  let buffer: Buffer = Buffer.alloc(0);

  const resize =
    longest > maxEdgePx && longest > 0
      ? {
          width: w >= h ? maxEdgePx : undefined,
          height: h > w ? maxEdgePx : undefined,
          fit: 'inside' as const,
          withoutEnlargement: true,
        }
      : undefined;

  while (true) {
    let pipeline = sharp(input, { failOn: 'warning' }).rotate();
    if (resize) {
      pipeline = pipeline.resize(resize);
    }
    buffer = await pipeline.webp({ quality, effort: 4 }).toBuffer();
    if (buffer.length <= targetBytes * 1.1 || quality <= QUALITY_MIN) {
      break;
    }
    quality = Math.max(QUALITY_MIN, quality - QUALITY_STEP);
  }

  const outMeta = await sharp(buffer).metadata();
  return {
    buffer,
    width: outMeta.width ?? w,
    height: outMeta.height ?? h,
    byteSize: buffer.length,
  };
}

export async function processImageBuffer(
  buffer: Buffer,
  assetType: AssetType,
  detectedMime: string,
): Promise<ProcessedImageResult> {
  const budgets = BYTE_BUDGETS[assetType];

  const display = await encodeWebpToBudget(buffer, budgets.targetBytes, budgets.maxEdgePx);

  let thumb: ProcessedVariant | null = null;
  if (assetTypeNeedsThumb(assetType) && budgets.thumbTargetBytes > 0) {
    thumb = await encodeWebpToBudget(
      buffer,
      budgets.thumbTargetBytes,
      budgets.thumbMaxEdgePx,
    );
  }

  return {
    display,
    thumb,
    detectedMime,
    originalBytes: buffer.length,
  };
}
