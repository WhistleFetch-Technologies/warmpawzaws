/**
 * S3 helpers for vendor product images.
 * Stored keys: products/{vendorId}/{timestamp}_{random}.{ext}
 */

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { normalizeImagesArray } from './product-sku-resolve';

export const PRODUCT_S3_PREFIX = 'products/';
/** Client target is 500 KB; allow slight encoding variance on server. */
export const PRODUCT_UPLOAD_MAX_BYTES = 512 * 1024;

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const s3Client = new S3Client({ region: AWS_REGION });

export function getProductUploadsBucket(): string {
  return (
    process.env.S3_UPLOADS_BUCKET ||
    process.env.S3_BUCKET_NAME ||
    'warmpawz-dev-user-uploads-057442119249'
  );
}

function stripPresignQuery(raw: string): string {
  if (!raw.includes('X-Amz-Algorithm=') && !raw.includes('X-Amz-Credential=')) {
    return raw;
  }
  try {
    const u = new URL(raw);
    u.search = '';
    return u.toString();
  } catch {
    return raw.split('?')[0] ?? raw;
  }
}

function isKeyForVendor(key: string, vendorId?: string): boolean {
  if (!key.startsWith(PRODUCT_S3_PREFIX)) return false;
  if (!vendorId) return true;
  return key.startsWith(`${PRODUCT_S3_PREFIX}${vendorId}/`);
}

export function extractProductS3Key(value: unknown, vendorId?: string): string | null {
  if (value == null) return null;
  let raw = String(value).trim();
  if (!raw) return null;

  raw = stripPresignQuery(raw);

  if (raw.startsWith(PRODUCT_S3_PREFIX)) {
    return isKeyForVendor(raw, vendorId) ? raw : null;
  }

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw);
      const match = u.hostname.match(/^([^.]+)\.s3[./]/);
      if (match) {
        const key = decodeURIComponent(u.pathname.replace(/^\//, ''));
        if (isKeyForVendor(key, vendorId)) {
          return key;
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function isManagedProductS3Image(value: unknown, vendorId?: string): boolean {
  return extractProductS3Key(value, vendorId) != null;
}

export async function deleteManagedProductS3Image(
  value: unknown,
  vendorId?: string,
): Promise<void> {
  const key = extractProductS3Key(value, vendorId);
  if (!key) return;

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: getProductUploadsBucket(),
        Key: key,
      }),
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[deleteManagedProductS3Image] failed:', msg);
  }
}

export function collectImageUrlsFromJsonb(raw: unknown): string[] {
  return normalizeImagesArray(raw);
}

export function collectAllProductImageUrls(
  productRow: Record<string, unknown>,
  skuRows: Array<{ images?: unknown }>,
): string[] {
  const urls = new Set<string>();
  for (const u of collectImageUrlsFromJsonb(productRow.images)) {
    if (u) urls.add(u);
  }
  for (const sku of skuRows) {
    for (const u of collectImageUrlsFromJsonb(sku.images)) {
      if (u) urls.add(u);
    }
  }
  return [...urls];
}

export function diffRemovedManagedKeys(
  prevUrls: string[],
  nextUrls: string[],
  vendorId: string,
): string[] {
  const nextKeys = new Set(
    nextUrls
      .map((u) => extractProductS3Key(u, vendorId))
      .filter((k): k is string => Boolean(k)),
  );
  const removed: string[] = [];
  for (const url of prevUrls) {
    const key = extractProductS3Key(url, vendorId);
    if (key && !nextKeys.has(key)) {
      removed.push(key);
    }
  }
  return [...new Set(removed)];
}

export async function cleanupRemovedProductS3Images(
  prevUrls: string[],
  nextUrls: string[],
  vendorId: string,
): Promise<void> {
  const keys = diffRemovedManagedKeys(prevUrls, nextUrls, vendorId);
  await Promise.all(keys.map((key) => deleteManagedProductS3Image(key, vendorId)));
}

export async function deleteAllManagedProductImages(
  urls: string[],
  vendorId: string,
): Promise<void> {
  const keys = [
    ...new Set(
      urls
        .map((u) => extractProductS3Key(u, vendorId))
        .filter((k): k is string => Boolean(k)),
    ),
  ];
  await Promise.all(keys.map((key) => deleteManagedProductS3Image(key, vendorId)));
}

export async function uploadProductImageBufferToS3(
  vendorId: string,
  buffer: Buffer,
  contentType: string,
  fileExtension: string,
): Promise<string> {
  const bucket = getProductUploadsBucket();
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  const ext = fileExtension.replace(/^\./, '') || 'jpg';
  const fileKey = `${PRODUCT_S3_PREFIX}${vendorId}/${timestamp}_${randomStr}.${ext}`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: fileKey,
      Body: buffer,
      ContentType: contentType || 'image/jpeg',
    }),
  );
  return `https://${bucket}.s3.${AWS_REGION}.amazonaws.com/${fileKey}`;
}

export function extensionFromContentType(contentType: string): string {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  return 'jpg';
}
