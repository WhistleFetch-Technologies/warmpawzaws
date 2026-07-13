/**
 * S3 helpers for admin-managed banner background images.
 * Stored keys: admin/banners/{bannerId}.webp
 */

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { buildPublicS3ObjectUrl } from './s3-presign-upload';
import { presignS3GetUrlIfApplicable } from './s3-media-presign';
import { resolveImageForContext } from '../services/image';

export const BANNER_S3_PREFIX = 'admin/banners/';
export const BANNER_UPLOAD_MAX_BYTES = 220 * 1024;

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const s3Client = new S3Client({ region: AWS_REGION });

export function getBannerUploadsBucket(): string {
  return process.env.S3_UPLOADS_BUCKET || process.env.S3_BUCKET_NAME || 'warmpawz-dev-uploads';
}

export function bannerS3KeyForId(bannerId: string): string {
  return `${BANNER_S3_PREFIX}${bannerId}.webp`;
}

export function extractBannerS3Key(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (raw.startsWith(BANNER_S3_PREFIX)) {
    return raw;
  }

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw);
      const match = u.hostname.match(/^([^.]+)\.s3[./]/);
      if (match) {
        const key = decodeURIComponent(u.pathname.replace(/^\//, ''));
        if (key.startsWith(BANNER_S3_PREFIX)) {
          return key;
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function isManagedBannerS3Image(value: unknown): boolean {
  return extractBannerS3Key(value) != null;
}

export async function deleteManagedBannerS3Image(value: unknown): Promise<void> {
  const key = extractBannerS3Key(value);
  if (!key) return;

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: getBannerUploadsBucket(),
        Key: key,
      })
    );
  } catch (error: any) {
    console.warn('[deleteManagedBannerS3Image] failed:', error?.message || error);
  }
}

export async function presignBannerImageForDisplay(
  value: unknown,
  bannerId?: string,
): Promise<string | null | undefined> {
  if (value == null || value === '') return value as null | undefined;
  const raw = String(value).trim();
  if (!raw) return raw;
  if (raw.startsWith('data:') || raw.startsWith('/')) return raw;
  if (raw.includes('X-Amz-Algorithm=') || raw.includes('X-Amz-Credential=')) return raw;

  const resolved = await resolveImageForContext(raw, {
    assetType: 'banner',
    ownerId: bannerId || 'banner',
    context: 'list',
    migrate: true,
    persist: bannerId
      ? {
          kind: 'scalar',
          table: 'banners',
          column: 'image_url',
          idColumn: 'id',
          id: bannerId,
        }
      : null,
  });
  if (resolved?.displayUrl) return resolved.displayUrl;

  const key = extractBannerS3Key(raw);
  if (key) {
    const url = buildPublicS3ObjectUrl(getBannerUploadsBucket(), key, AWS_REGION);
    return (await presignS3GetUrlIfApplicable(url)) ?? url;
  }

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return (await presignS3GetUrlIfApplicable(raw)) ?? raw;
  }

  return raw;
}

export async function uploadBannerImageToS3(opts: {
  bannerId: string;
  body: Uint8Array;
  contentType: string;
}): Promise<{ fileKey: string }> {
  const fileKey = bannerS3KeyForId(opts.bannerId);
  const bucket = getBannerUploadsBucket();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: fileKey,
      Body: opts.body,
      ContentType: opts.contentType,
    })
  );

  return { fileKey };
}

/** Delete old managed image when image_url changes away from the same key. */
export async function cleanupBannerImageOnUrlChange(
  previousUrl: unknown,
  nextUrl: unknown
): Promise<void> {
  const prevKey = extractBannerS3Key(previousUrl);
  if (!prevKey) return;

  const nextKey = extractBannerS3Key(nextUrl);
  if (nextKey === prevKey) return;

  await deleteManagedBannerS3Image(prevKey);
}
