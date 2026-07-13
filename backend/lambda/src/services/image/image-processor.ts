/**
 * Sharp-based WebP encoding with byte-budget targets.
 */

import type { AssetType, ProcessedImageResult, ProcessedVariant } from './image-types';
import { BYTE_BUDGETS, MAX_IMAGE_DIMENSION, assetTypeNeedsThumb } from './image-types';

const QUALITY_START = 85;
const QUALITY_MIN = 35;
const QUALITY_STEP = 8;

async function getSharp() {
  return (await import('sharp')).default;
}

async function readInputDimensions(input: Buffer): Promise<{ w: number; h: number }> {
  const sharp = await getSharp();
  try {
    const meta = await sharp(input, { failOn: 'none' }).rotate().metadata();
    return { w: meta.width ?? 0, h: meta.height ?? 0 };
  } catch {
    return { w: 0, h: 0 };
  }
}

async function encodeWebpToBudget(
  input: Buffer,
  targetBytes: number,
  maxEdgePx: number,
): Promise<ProcessedVariant> {
  const sharp = await getSharp();
  let { w, h } = await readInputDimensions(input);
  if (w > MAX_IMAGE_DIMENSION || h > MAX_IMAGE_DIMENSION) {
    throw new Error(
      `Image dimensions must be ${MAX_IMAGE_DIMENSION}px or smaller per edge`,
    );
  }

  const longest = w > 0 && h > 0 ? Math.max(w, h) : maxEdgePx;
  const resize =
    longest > maxEdgePx
      ? {
          width: w <= 0 || h <= 0 || w >= h ? maxEdgePx : undefined,
          height: w > 0 && h > 0 && h > w ? maxEdgePx : undefined,
          fit: 'inside' as const,
          withoutEnlargement: true,
        }
      : w > 0 && h > 0
        ? undefined
        : {
            width: maxEdgePx,
            height: maxEdgePx,
            fit: 'inside' as const,
            withoutEnlargement: true,
          };

  let quality = QUALITY_START;
  let buffer: Buffer = Buffer.alloc(0);

  while (true) {
    let pipeline = sharp(input, { failOn: 'none' }).rotate();
    if (resize) {
      pipeline = pipeline.resize(resize);
    }
    buffer = await pipeline.webp({ quality, effort: 4 }).toBuffer();
    if (buffer.length <= targetBytes * 1.1 || quality <= QUALITY_MIN) {
      break;
    }
    quality = Math.max(QUALITY_MIN, quality - QUALITY_STEP);
  }

  const outMeta = await sharp(buffer, { failOn: 'none' }).metadata();
  return {
    buffer,
    width: outMeta.width ?? w,
    height: outMeta.height ?? h,
    byteSize: buffer.length,
  };
}

async function flattenToJpegBuffer(input: Buffer): Promise<Buffer> {
  const sharp = await getSharp();
  return sharp(input, { failOn: 'none' }).rotate().jpeg({ quality: 92 }).toBuffer();
}

export async function processImageBuffer(
  buffer: Buffer,
  assetType: AssetType,
  detectedMime: string,
): Promise<ProcessedImageResult> {
  const budgets = BYTE_BUDGETS[assetType];

  let display: ProcessedVariant;
  try {
    display = await encodeWebpToBudget(buffer, budgets.targetBytes, budgets.maxEdgePx);
  } catch (firstErr: unknown) {
    console.warn(
      JSON.stringify({
        event: 'image.encode.retry_flatten_jpeg',
        assetType,
        error: (firstErr as Error)?.message || firstErr,
      }),
    );
    const flattened = await flattenToJpegBuffer(buffer);
    display = await encodeWebpToBudget(flattened, budgets.targetBytes, budgets.maxEdgePx);
  }

  let thumb: ProcessedVariant | null = null;
  if (assetTypeNeedsThumb(assetType) && budgets.thumbTargetBytes > 0) {
    try {
      thumb = await encodeWebpToBudget(buffer, budgets.thumbTargetBytes, budgets.thumbMaxEdgePx);
    } catch {
      const flattened = await flattenToJpegBuffer(buffer);
      thumb = await encodeWebpToBudget(flattened, budgets.thumbTargetBytes, budgets.thumbMaxEdgePx);
    }
  }

  return {
    display,
    thumb,
    detectedMime,
    originalBytes: buffer.length,
  };
}
