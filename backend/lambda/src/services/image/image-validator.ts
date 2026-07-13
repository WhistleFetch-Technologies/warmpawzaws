/**
 * Pre-Sharp validation: magic-byte MIME sniffing (never trust Content-Type header).
 */

import { MAX_IMAGE_DIMENSION, MAX_UPLOAD_BYTES } from './image-types';

export type ValidationResult = { ok: true; detectedMime: string } | { ok: false; message: string };

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

function readAscii(buf: Buffer, start: number, len: number): string {
  return buf.subarray(start, start + len).toString('ascii');
}

/** Magic-byte detection; returns null if unrecognized. */
export function detectImageMime(buffer: Buffer): string | null {
  if (buffer.length < 3) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  if (readAscii(buffer, 0, 4) === 'RIFF' && readAscii(buffer, 8, 4) === 'WEBP') {
    return 'image/webp';
  }

  if (readAscii(buffer, 0, 6) === 'GIF87a' || readAscii(buffer, 0, 6) === 'GIF89a') {
    return 'image/gif';
  }

  // ISO BMFF (HEIC/HEIF): ....ftypheic / ftypmif1 / ftypheix
  if (buffer.length >= 12 && readAscii(buffer, 4, 4) === 'ftyp') {
    const brand = readAscii(buffer, 8, 4).toLowerCase();
    if (brand.startsWith('hei') || brand === 'mif1' || brand === 'msf1') {
      return 'image/heic';
    }
  }

  return null;
}

export function validateImageBuffer(
  buffer: Buffer,
  declaredContentType?: string,
  maxBytes: number = MAX_UPLOAD_BYTES,
): ValidationResult {
  if (!buffer || buffer.length === 0) {
    return { ok: false, message: 'Image file is empty' };
  }

  if (buffer.length > maxBytes) {
    return {
      ok: false,
      message: `Image must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller`,
    };
  }

  const detectedMime = detectImageMime(buffer);
  if (!detectedMime || !ALLOWED_MIMES.has(detectedMime)) {
    return { ok: false, message: 'Unsupported or invalid image format' };
  }

  const declared = (declaredContentType || '').toLowerCase().split(';')[0].trim();
  if (
    declared &&
    declared.startsWith('image/') &&
    !declared.includes('octet-stream') &&
    declared !== detectedMime &&
    !(declared === 'image/jpg' && detectedMime === 'image/jpeg') &&
    !(declared === 'image/heif' && detectedMime === 'image/heic')
  ) {
    return { ok: false, message: 'File content does not match declared image type' };
  }

  return { ok: true, detectedMime };
}

function dimensionValidationMessage(detectedMime: string | null, err: unknown): string {
  const sharpMsg = (err as Error)?.message || String(err);
  if (detectedMime === 'image/heic' || detectedMime === 'image/heif') {
    return 'HEIC/HEIF is not supported on the server. Please upload JPEG or PNG.';
  }
  if (/heif|heic|compression format/i.test(sharpMsg)) {
    return 'HEIC/HEIF is not supported on the server. Please upload JPEG or PNG.';
  }
  if (/invalid|corrupt|truncated|unsupported/i.test(sharpMsg)) {
    return 'Corrupted or unreadable image file';
  }
  return 'Corrupted or unreadable image file';
}

export async function validateImageDimensions(buffer: Buffer): Promise<ValidationResult> {
  const mime = detectImageMime(buffer);
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(buffer, { failOn: 'warning' }).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w <= 0 || h <= 0) {
      return { ok: false, message: 'Could not read image dimensions' };
    }
    if (w > MAX_IMAGE_DIMENSION || h > MAX_IMAGE_DIMENSION) {
      return {
        ok: false,
        message: `Image dimensions must be ${MAX_IMAGE_DIMENSION}px or smaller per edge`,
      };
    }
    if (!mime) {
      return { ok: false, message: 'Unsupported or invalid image format' };
    }
    return { ok: true, detectedMime: mime };
  } catch (err: unknown) {
    console.warn(
      '[image-validator] validateImageDimensions failed:',
      mime,
      (err as Error)?.message || err,
    );
    return { ok: false, message: dimensionValidationMessage(mime, err) };
  }
}
