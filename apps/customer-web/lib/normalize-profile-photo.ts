/**
 * Re-encode profile/pet photos to a Sharp-friendly JPEG before POST /storage/upload-media.
 * Vendor product uploads already use compress-product-image.ts; customer paths did not.
 */

export const PROFILE_PHOTO_MAX_EDGE_PX = 2048;
export const PROFILE_PHOTO_MAX_INPUT_BYTES = 10 * 1024 * 1024;

const JPEG_QUALITY = 0.85;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process image'))),
      type,
      quality,
    );
  });
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      throw new Error(
        'Could not read this image. Save as JPEG or PNG and try again (HEIC may not work in this browser).',
      );
    }
  }
}

/** Canvas re-encode → JPEG, max edge 2048px (matches server profile byte budget). */
export async function normalizeProfilePhotoFile(file: File): Promise<File> {
  if (!file || file.size === 0) {
    throw new Error('Invalid file: File is empty or not selected');
  }
  if (file.size > PROFILE_PHOTO_MAX_INPUT_BYTES) {
    throw new Error('Image must be 10 MB or smaller');
  }

  const bitmap = await loadBitmap(file);
  const { width, height } = bitmap;
  const longest = Math.max(width, height);
  let targetW = width;
  let targetH = height;
  if (longest > PROFILE_PHOTO_MAX_EDGE_PX) {
    const scale = PROFILE_PHOTO_MAX_EDGE_PX / longest;
    targetW = Math.round(width * scale);
    targetH = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('Could not process image');
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}
