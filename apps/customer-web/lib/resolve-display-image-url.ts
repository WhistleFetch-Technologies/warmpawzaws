/**
 * Returns a URL or managed S3 key safe for CachedImage (signs keys before <img src>).
 */
import { extractS3ImageKey } from './image-asset-cache';
import { resolveVendorProfilePhotoUrl } from './vendor-display-media';

export function sanitizeDisplayImageUrl(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s || s === 'null' || s === 'undefined' || s === 'NaN') return undefined;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\/\//.test(s)) return `https:${s}`;
  if (s.startsWith('data:') || s.startsWith('blob:')) return s;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  if (extractS3ImageKey(s)) return s;
  return undefined;
}

/** Collect profile image from by-problem / discover row shapes */
export function pickVendorPhotoFromRow(row: Record<string, unknown>): string | undefined {
  const keys = [
    'profile_photo_url',
    'profilePhotoUrl',
    'photo',
    'photoUrl',
    'logo_url',
    'logoUrl',
    'vendorPhoto',
    'vendorProfileImage',
    'imageUrl',
    'image_url',
  ] as const;
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) {
      const ok = sanitizeDisplayImageUrl(v);
      if (ok) return ok;
    }
  }
  return undefined;
}

/** Normalize discovery/list provider rows to a single display photo URL. */
export function normalizeProviderListPhoto(
  row: Record<string, unknown> | null | undefined
): string | undefined {
  if (!row) return undefined;
  return pickVendorPhotoFromRow(row) || resolveVendorProfilePhotoUrl(row);
}
