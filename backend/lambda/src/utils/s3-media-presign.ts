/**
 * Presign S3 object URLs for browser display when the bucket is private.
 * Leaves non-S3 URLs, data URLs, and already-presigned URLs unchanged.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

/**
 * If `url` points at S3 (virtual-hosted style), return a GET presigned URL.
 * Uses the bucket name from the URL so prod/staging buckets work even when env defaults differ.
 */
export async function presignS3GetUrlIfApplicable(
  url: string | null | undefined
): Promise<string | null | undefined> {
  if (url == null || url === '') return url;
  if (typeof url !== 'string') return url;
  if (url.startsWith('data:')) return url;
  if (url.includes('X-Amz-Algorithm=') || url.includes('X-Amz-Credential=')) return url;

  try {
    const u = new URL(url);
    const host = u.hostname;
    // e.g. my-bucket.s3.ap-south-1.amazonaws.com
    const match = host.match(/^([^.]+)\.s3[./]/);
    if (!match) return url;
    const bucket = match[1];

    const key = decodeURIComponent(u.pathname.replace(/^\//, ''));
    if (!key) return url;

    return await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 604800 }
    );
  } catch (e: any) {
    console.warn('[presignS3GetUrlIfApplicable] skipped:', e?.message || e);
    return url;
  }
}

/**
 * Presign every string URL in products.images JSONB (and { url | src | image_url } objects).
 * Handles column returned as JSON array or JSON string from pg.
 */
export async function presignProductImagesJsonb(raw: unknown): Promise<unknown> {
  if (raw == null) return raw;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return (await presignS3GetUrlIfApplicable(raw)) ?? raw;
    }
  }
  if (!Array.isArray(parsed)) return raw;
  return await Promise.all(
    parsed.map(async (item) => {
      if (typeof item === 'string') {
        return (await presignS3GetUrlIfApplicable(item)) ?? item;
      }
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        for (const k of ['url', 'src', 'image_url'] as const) {
          if (typeof o[k] === 'string') {
            const signed = (await presignS3GetUrlIfApplicable(o[k] as string)) ?? o[k];
            return { ...o, [k]: signed };
          }
        }
      }
      return item;
    }),
  );
}

/** Presign product.images and metadata.images for API responses (private S3 bucket). */
export async function presignProductRowForDisplay(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...row };
  if ('images' in out) {
    out.images = await presignProductImagesJsonb(out.images);
  }
  if (out.metadata != null && typeof out.metadata === 'object' && !Array.isArray(out.metadata)) {
    const m = { ...(out.metadata as Record<string, unknown>) };
    if ('images' in m) {
      m.images = await presignProductImagesJsonb(m.images);
    }
    out.metadata = m;
  }
  return out;
}

/** Remove SigV4 query params so we persist stable object URLs (not expiring presigned URLs). */
export function stripS3PresignQueryFromUrl(url: string): string {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('.s3.') || !u.hostname.includes('amazonaws.com')) {
      return url;
    }
    if (u.searchParams.has('X-Amz-Algorithm') || u.searchParams.has('X-Amz-Credential')) {
      u.search = '';
      return u.toString();
    }
  } catch {
    return url;
  }
  return url;
}

export function stripPresignFromProductImagesJsonb(raw: unknown): unknown {
  if (raw == null) return raw;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return stripS3PresignQueryFromUrl(raw);
    }
  }
  if (!Array.isArray(parsed)) return raw;
  return parsed.map((item) => {
    if (typeof item === 'string') {
      return stripS3PresignQueryFromUrl(item);
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      const next = { ...o };
      for (const k of ['url', 'src', 'image_url'] as const) {
        if (typeof next[k] === 'string') {
          next[k] = stripS3PresignQueryFromUrl(next[k] as string);
        }
      }
      return next;
    }
    return item;
  });
}
