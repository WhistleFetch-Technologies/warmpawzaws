/**
 * Shared vendor listing avatar resolution (search, discover-services, OpenSearch sync).
 * Center/business: metadata.facility_photos gallery first; solo: profile_photo_url first.
 */
import { regeneratePresignedUrl } from '../endpoints/constants/helper';

export function vendorGalleryDrivesListingPhoto(v: Record<string, unknown> | null | undefined): boolean {
  const vt = String(v?.vendor_type ?? '').toLowerCase().trim();
  return vt !== 'solo';
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

/**
 * Unified vendor listing photo URL (same order as legacy getVendorPhotoUrl in service-discovery).
 * Regenerates pre-signed S3 URLs on demand.
 */
export async function getVendorListingPhotoUrl(
  v: Record<string, unknown> | null | undefined
): Promise<string | null> {
  if (!v) return null;

  const firstFacility = firstFacilityPhotoFromMetadata(v);

  if (firstFacility && vendorGalleryDrivesListingPhoto(v)) {
    return await regeneratePresignedUrl(firstFacility);
  }

  const url = v.profile_photo_url || v.profile_image || v.logo_url || null;
  if (url && String(url).trim()) {
    return await regeneratePresignedUrl(String(url).trim());
  }
  if (firstFacility) {
    return await regeneratePresignedUrl(firstFacility);
  }
  return null;
}
