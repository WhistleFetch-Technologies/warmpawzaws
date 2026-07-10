/**
 * Presign S3 object URLs for browser display when the bucket is private.
 * Leaves non-S3 URLs, data URLs, and already-presigned URLs unchanged.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { flattenProductForApiResponse, sanitizeStorefrontProductForCustomer } from './product-storefront-normalize';
import {
  enrichProductImageForContext,
  mapWithConcurrency,
  type EnrichedProductImage,
} from '../services/image';
import type { ImageDisplayContext } from '../services/image/image-types';

const IMAGE_LIST_CONCURRENCY = 3;

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
 * List context prefers thumb URLs for managed WebP assets.
 */
export async function presignProductImagesJsonb(
  raw: unknown,
  context: ImageDisplayContext = 'detail',
  vendorId?: string,
): Promise<unknown> {
  if (raw == null) return raw;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      const enriched = await enrichProductImageForContext(raw, {
        assetType: 'product',
        ownerId: vendorId || 'unknown',
        vendorId,
        context,
        migrate: false,
      });
      return flattenEnrichedImageForApi(enriched);
    }
  }
  if (!Array.isArray(parsed)) return raw;
  const enriched = await mapWithConcurrency(parsed, IMAGE_LIST_CONCURRENCY, async (item) => {
    return enrichProductImageForContext(item, {
      assetType: 'product',
      ownerId: vendorId || 'unknown',
      vendorId,
      context,
      migrate: false,
    });
  });
  return enriched.map(flattenEnrichedImageForApi);
}

function flattenEnrichedImageForApi(item: EnrichedProductImage): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object' && 'displayUrl' in item) {
    return item.displayUrl;
  }
  return '';
}

/** Normalize products.images from JSONB, JSON string, or a single URL into a string array. */
export function normalizeProductImagesField(raw: unknown): string[] {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    if (s.startsWith('[') || s.startsWith('{')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((x) => String(x ?? '').trim()).filter(Boolean);
        }
        if (typeof parsed === 'string' && parsed.trim()) {
          return [parsed.trim()];
        }
      } catch {
        /* single URL or malformed JSON — treat as one URL below */
      }
    }
    return [s];
  }
  return [];
}

/**
 * Public storefront: normalize images + presign private S3 URLs (same as vendor catalog APIs).
 */
export async function prepareStorefrontProductRow(
  row: Record<string, unknown>,
  context: ImageDisplayContext = 'list',
): Promise<Record<string, unknown>> {
  const normalized = flattenProductForApiResponse(row);
  const out: Record<string, unknown> = { ...normalized };
  if ('images' in out) {
    out.images = normalizeProductImagesField(out.images);
  }
  const presigned = await presignProductRowForDisplay(out, context);
  return sanitizeStorefrontProductForCustomer(presigned);
}

export async function prepareStorefrontProductRows(
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  return Promise.all(rows.map((r) => prepareStorefrontProductRow(r, 'list')));
}

/** Presign product.images and metadata.images for API responses (private S3 bucket). */
export async function presignProductRowForDisplay(
  row: Record<string, unknown>,
  context: ImageDisplayContext = 'detail',
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...row };
  const vendorId =
    typeof out.vendor_id === 'string'
      ? out.vendor_id
      : typeof out.vendorId === 'string'
        ? out.vendorId
        : undefined;

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
    out.images = await presignProductImagesJsonb(out.images, context, vendorId);
  }
  if (out.metadata != null && typeof out.metadata === 'object' && !Array.isArray(out.metadata)) {
    const m = { ...(out.metadata as Record<string, unknown>) };
    if ('images' in m) {
      m.images = await presignProductImagesJsonb(m.images, context, vendorId);
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

export async function presignProductSkusForDisplay(
  skus: Record<string, unknown>[],
  context: ImageDisplayContext = 'detail',
): Promise<Record<string, unknown>[]> {
  return Promise.all(
    skus.map(async (sku) => {
      const out = { ...sku };
      const vendorId =
        typeof out.vendor_id === 'string'
          ? out.vendor_id
          : typeof out.vendorId === 'string'
            ? out.vendorId
            : undefined;
      if ('images' in out) {
        out.images = await presignProductImagesJsonb(out.images, context, vendorId);
      }
      return out;
    }),
  );
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
