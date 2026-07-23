/**
 * Shared vendor listing avatar resolution (search, discover-services, OpenSearch sync).
 * Center/business: metadata.facility_photos gallery first; solo: profile_photo_url first.
 */
import { resolveImageForContext } from '../services/image';
import { extractRawImageKey } from '../services/image/image-migrator';
import { isWebpKey } from '../services/image/image-key-builder';
import { regeneratePresignedUrl } from '../endpoints/constants/helper';

export function vendorGalleryDrivesListingPhoto(v: Record<string, unknown> | null | undefined): boolean {
  const vt = String(v?.vendor_type ?? '').toLowerCase().trim();
  return vt !== 'solo';
}

function vendorIdFrom(v: Record<string, unknown>): string {
  return String(v.id ?? v.vendor_id ?? v.vendorId ?? '').trim();
}

function firstFacilityPhotoFromMetadata(v: Record<string, unknown>): string | null {
  try {
    const meta = v.metadata;
    const m = typeof meta === 'string' ? (meta ? JSON.parse(meta) : {}) : meta || {};
    const photos = (m as Record<string, unknown>)?.facility_photos || (m as Record<string, unknown>)?.photos;
    const first = Array.isArray(photos) && photos[0] ? String(photos[0]).trim() : '';
    return first || null;
  } catch {
    return null;
  }
}

async function listingPhotoDisplayUrl(
  raw: string,
  v: Record<string, unknown>,
  assetType: 'facility' | 'profile',
): Promise<string | null> {
  const vendorId = vendorIdFrom(v);
  if (vendorId) {
    const resolved = await resolveImageForContext(raw, {
      assetType,
      ownerId: vendorId,
      vendorId,
      context: 'list',
      migrate: false,
    });
    const regen = await regeneratePresignedUrl(raw);
    const key = extractRawImageKey(raw);
    if (key && !isWebpKey(key) && regen) {
      return regen;
    }
    if (resolved?.displayUrl) return resolved.displayUrl;
    if (regen) return regen;
  }
  return regeneratePresignedUrl(raw);
}

/**
 * Unified vendor listing photo URL (same order as legacy getVendorPhotoUrl in service-discovery).
 * List context: thumb when available via ImageService resolve layer.
 */
export async function getVendorListingPhotoUrl(
  v: Record<string, unknown> | null | undefined
): Promise<string | null> {
  if (!v) return null;

  const firstFacility = firstFacilityPhotoFromMetadata(v);

  if (firstFacility && vendorGalleryDrivesListingPhoto(v)) {
    return listingPhotoDisplayUrl(firstFacility, v, 'facility');
  }

  const url = v.profile_photo_url || v.profile_image || v.logo_url || null;
  if (url && String(url).trim()) {
    return listingPhotoDisplayUrl(String(url).trim(), v, 'profile');
  }
  if (firstFacility) {
    return listingPhotoDisplayUrl(firstFacility, v, 'facility');
  }
  return null;
}
