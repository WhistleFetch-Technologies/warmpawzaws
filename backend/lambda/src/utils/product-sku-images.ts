/**
 * Product image processing for SKU rows — mirrors vendor product image pipeline.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { stripPresignFromProductImagesJsonb } from './s3-media-presign';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const S3_BUCKET_NAME =
  process.env.S3_UPLOADS_BUCKET || process.env.S3_BUCKET_NAME || 'warmpawz-dev-uploads';
const AWS_REGION_EFFECTIVE = process.env.AWS_REGION || 'ap-south-1';

async function uploadProductImageBufferToS3(
  vendorId: string,
  buffer: Buffer,
  contentType: string,
  fileExtension: string,
): Promise<string> {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const ext = fileExtension.replace(/^\./, '') || 'jpg';
  const fileKey = `products/${vendorId}/${timestamp}_${randomStr}.${ext}`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: fileKey,
      Body: buffer,
      ContentType: contentType || 'image/jpeg',
    }),
  );
  return `https://${S3_BUCKET_NAME}.s3.${AWS_REGION_EFFECTIVE}.amazonaws.com/${fileKey}`;
}

async function tryUploadDataImageUrlToS3(vendorId: string, dataUrl: string): Promise<string | null> {
  const m = dataUrl.match(/^data:image\/([\w.+-]+);base64,(.+)$/i);
  if (!m) return null;
  const mimeSubtype = m[1].toLowerCase();
  const ext = mimeSubtype === 'jpeg' || mimeSubtype === 'pjpeg' ? 'jpg' : mimeSubtype.split('+')[0] || 'jpg';
  const contentType = `image/${m[1]}`;
  try {
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length) return null;
    return await uploadProductImageBufferToS3(vendorId, buf, contentType, ext);
  } catch (e) {
    console.error('[product-sku-images] Failed to upload data:image', e);
    return null;
  }
}

async function resolveSingleProductImageToS3Url(vendorId: string, item: unknown): Promise<string | null> {
  if (typeof item === 'string') {
    const s = item.trim();
    if (!s) return null;
    if (s.startsWith('blob:')) return null;
    if (s.startsWith('data:image/')) return tryUploadDataImageUrlToS3(vendorId, s);
    return s;
  }
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const o = item as Record<string, unknown>;
    const existing =
      typeof o.url === 'string'
        ? o.url
        : typeof o.src === 'string'
          ? o.src
          : typeof o.image_url === 'string'
            ? o.image_url
            : null;
    if (existing?.startsWith('data:image/')) return tryUploadDataImageUrlToS3(vendorId, existing);
    if (existing && typeof existing === 'string') return existing.trim() || null;
  }
  return null;
}

export async function processProductImagesForS3Storage(
  vendorId: string,
  raw: unknown,
): Promise<string[]> {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: string[] = [];
  for (const item of raw) {
    const url = await resolveSingleProductImageToS3Url(vendorId, item);
    if (url) out.push(url);
  }
  return out;
}

export { stripPresignFromProductImagesJsonb };
