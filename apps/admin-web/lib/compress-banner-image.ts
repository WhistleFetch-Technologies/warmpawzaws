export const BANNER_IMAGE_MAX_BYTES = 200 * 1024;
export const BANNER_IMAGE_MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const BANNER_IMAGE_MAX_EDGE_PX = 4000;

export const ALLOWED_BANNER_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const BANNER_S3_KEY_PREFIX = 'admin/banners/';

const COMPRESS_START_QUALITY = 0.85;
const COMPRESS_MIN_QUALITY = 0.35;
const COMPRESS_QUALITY_STEP = 0.08;

export type BannerImageValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function isManagedBannerStorageKey(value: unknown): boolean {
  const raw = String(value ?? '').trim();
  return raw.startsWith(BANNER_S3_KEY_PREFIX);
}

export function validateBannerImageFile(file: File): BannerImageValidationResult {
  if (!file || file.size === 0) {
    return { ok: false, message: 'Please select an image file' };
  }

  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_BANNER_IMAGE_TYPES.has(mime)) {
    return {
      ok: false,
      message: 'Only JPEG, PNG, and WebP images are supported for banner upload',
    };
  }

  if (file.size > BANNER_IMAGE_MAX_INPUT_BYTES) {
    return { ok: false, message: 'Image must be 10 MB or smaller' };
  }

  return { ok: true };
}

export function formatBannerImageSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
      type,
      quality
    );
  });
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return createImageBitmap(file);
  }
}

async function readImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  const bitmap = await loadBitmap(file);
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return dims;
}

export async function validateBannerImageDimensions(
  file: File
): Promise<BannerImageValidationResult> {
  const base = validateBannerImageFile(file);
  if (!base.ok) return base;

  const { width, height } = await readImageDimensions(file);
  const longest = Math.max(width, height);
  if (longest > BANNER_IMAGE_MAX_EDGE_PX) {
    return {
      ok: false,
      message: `Image longest edge must be ${BANNER_IMAGE_MAX_EDGE_PX}px or smaller`,
    };
  }
  return { ok: true };
}

async function compressWithCanvas(file: File): Promise<File> {
  const bitmap = await loadBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('Could not process image');
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  let mimeType = 'image/webp';
  let probe = await canvasToBlob(canvas, mimeType, COMPRESS_START_QUALITY).catch(() => null);
  if (!probe) {
    mimeType = 'image/jpeg';
    probe = await canvasToBlob(canvas, mimeType, COMPRESS_START_QUALITY);
  }

  let quality = COMPRESS_START_QUALITY;
  let blob = probe;

  while (blob.size > BANNER_IMAGE_MAX_BYTES && quality > COMPRESS_MIN_QUALITY) {
    quality = Math.max(COMPRESS_MIN_QUALITY, quality - COMPRESS_QUALITY_STEP);
    blob = await canvasToBlob(canvas, mimeType, quality);
  }

  if (blob.size > BANNER_IMAGE_MAX_BYTES) {
    throw new Error(
      'Could not compress below 200 KB at this resolution. Export a smaller image from your editor.'
    );
  }

  const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `banner.${ext}`, { type: mimeType });
}

/** Client-side quality-only compression to <= 200 KB. Skips re-encode when already small enough. */
export async function compressBannerImage(file: File): Promise<File> {
  const validation = await validateBannerImageDimensions(file);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  if (file.size <= BANNER_IMAGE_MAX_BYTES) {
    return file;
  }

  return compressWithCanvas(file);
}
