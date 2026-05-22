/**
 * Presign S3 object URLs for browser display when the bucket is private.
 * Leaves non-S3 URLs, data URLs, and already-presigned URLs unchanged.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

/** API origin for GET /storage/media/* proxy (matches Java customer-service CustomerMapper). */
export function getApiBaseUrlForMedia(): string {
  const raw =
    process.env.API_BASE_URL ||
    process.env.PUBLIC_API_BASE_URL ||
    '';
  return raw.trim().replace(/\/$/, '');
}

/**
 * Stable display URL: API Gateway redirects to a fresh S3 presign on each image load.
 * Avoids returning expiring SigV4 URLs (STS session dies before X-Amz-Expires).
 */
export function buildStorageMediaProxyUrl(keyOrUrl: string | null | undefined): string | null {
  if (keyOrUrl == null || keyOrUrl === '') return null;
  const base = getApiBaseUrlForMedia();
  if (!base) return null;

  let key = String(keyOrUrl).trim();
  if (!key || key.startsWith('data:')) return null;

  if (key.includes('://')) {
    const stripped = stripS3PresignQueryFromUrl(key);
    try {
      const u = new URL(stripped);
      if (!u.hostname.includes('.s3.') || !u.hostname.includes('amazonaws.com')) {
        return null;
      }
      key = decodeURIComponent(u.pathname.replace(/^\//, ''));
    } catch {
      return null;
    }
  }

  if (!key) return null;

  const encoded = key
    .split('/')
    .map((segment) => encodeURIComponent(segment).replace(/\+/g, '%20'))
    .join('/');

  return `${base}/storage/media/${encoded}`;
}

/**
 * Resolve customer/pet/product media for API JSON and <img src>.
 * Prefers /storage/media proxy; falls back to multi-bucket presign (legacy warmpawz-dev-uploads).
 */
export async function resolveMediaUrlForDisplay(
  raw: string | null | undefined
): Promise<string | null | undefined> {
  if (raw == null || raw === '') return raw;
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('data:')) return trimmed;

  const proxy = buildStorageMediaProxyUrl(trimmed);
  if (proxy) return proxy;

  const { regeneratePresignedUrl } = await import('../endpoints/constants/helper');
  const signed = await regeneratePresignedUrl(trimmed);
  return signed ?? trimmed;
}

/**
 * If `url` points at S3 (virtual-hosted style or key), return a display-safe URL.
 * Strips stale presigned query strings and resolves the correct bucket (dev has two upload buckets).
 */
export async function presignS3GetUrlIfApplicable(
  url: string | null | undefined
): Promise<string | null | undefined> {
  if (url == null || url === '') return url;
  if (typeof url !== 'string') return url;
  if (url.startsWith('data:')) return url;

  const stripped = stripS3PresignQueryFromUrl(url.trim());
  const proxy = buildStorageMediaProxyUrl(stripped);
  if (proxy) return proxy;

  if (stripped.includes('://')) {
    try {
      const u = new URL(stripped);
      const host = u.hostname;
      const match = host.match(/^([^.]+)\.s3[./]/);
      if (!match) return stripped;
      const bucket = match[1];
      const key = decodeURIComponent(u.pathname.replace(/^\//, ''));
      if (!key) return stripped;

      const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
      try {
        await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: bucket, Key: key }),
          { expiresIn: 604800 }
        );
      } catch {
        const { regeneratePresignedUrl } = await import('../endpoints/constants/helper');
        return (await regeneratePresignedUrl(stripped)) ?? stripped;
      }
    } catch (e: any) {
      console.warn('[presignS3GetUrlIfApplicable] skipped:', e?.message || e);
      return stripped;
    }
  }

  const { regeneratePresignedUrl } = await import('../endpoints/constants/helper');
  return (await regeneratePresignedUrl(stripped)) ?? stripped;
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

  const top = out.images;
  const topEmpty =
    top == null ||
    top === '' ||
    (Array.isArray(top) && top.length === 0);
  if (
    topEmpty &&
    out.metadata != null &&
    typeof out.metadata === 'object' &&
    !Array.isArray(out.metadata)
  ) {
    const m = out.metadata as Record<string, unknown>;
    const metaImgs = m.images;
    if (Array.isArray(metaImgs) && metaImgs.length > 0) {
      out.images = metaImgs;
    }
  }

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

/**
 * Presign `mealImageUrl` on a metadata / dietary_requirements object (private S3 bucket).
 */
export async function presignMealImageUrlInRecord(
  record: Record<string, unknown> | null | undefined
): Promise<Record<string, unknown>> {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return {};
  const out = { ...record };
  const u = out.mealImageUrl;
  if (typeof u === 'string' && u.trim()) {
    out.mealImageUrl = (await presignS3GetUrlIfApplicable(u.trim())) ?? u;
  }
  return out;
}

/**
 * For `meal_plans` API rows: parse `dietary_requirements` + `photos`, resolve hero image
 * (`mealImageUrl` → `thumbnail_url` → first photo), presign when stored on private S3.
 */
export async function presignMealPlanRowDisplayFields(mp: Record<string, unknown>): Promise<{
  dietary_requirements: Record<string, unknown>;
  photos: unknown;
  mealImageUrl: string | null;
}> {
  let dietaryReqs: Record<string, unknown> = {};
  try {
    const dr = mp.dietary_requirements;
    dietaryReqs =
      typeof dr === 'string'
        ? (JSON.parse(dr) as Record<string, unknown>)
        : ((dr as Record<string, unknown>) || {});
  } catch {
    dietaryReqs = {};
  }
  let photos: unknown = mp.photos;
  try {
    photos = typeof photos === 'string' ? JSON.parse(photos as string) : photos;
  } catch {
    photos = [];
  }
  photos = await presignProductImagesJsonb(photos);
  const drSigned = await presignMealImageUrlInRecord(dietaryReqs);
  const thumb = mp.thumbnail_url;
  const firstPhoto =
    Array.isArray(photos) && photos.length > 0
      ? typeof photos[0] === 'string'
        ? photos[0]
        : photos[0] && typeof photos[0] === 'object' && !Array.isArray(photos[0])
          ? String((photos[0] as Record<string, unknown>).url ?? (photos[0] as Record<string, unknown>).src ?? '')
          : ''
      : '';
  let mealImageUrl: string | null =
    (typeof drSigned.mealImageUrl === 'string' && drSigned.mealImageUrl) ||
    (typeof thumb === 'string' && thumb) ||
    (firstPhoto ? firstPhoto : null);
  if (typeof mealImageUrl === 'string') {
    mealImageUrl = (await presignS3GetUrlIfApplicable(mealImageUrl)) ?? mealImageUrl;
  }
  const dietary_requirements = { ...drSigned, ...(mealImageUrl ? { mealImageUrl } : {}) };
  return { dietary_requirements, photos, mealImageUrl };
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
