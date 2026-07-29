/**
 * Runtime debug — discovery vendor image field trace.
 */
export const WPAY_DISCOVERY_IMAGE_DEBUG_PREFIX = '[WPayDiscoveryImageDebug]';

const IMAGE_KEYS = [
  'photo',
  'photoUrl',
  'photo_url',
  'profilePhotoUrl',
  'profile_photo_url',
  'profileImageUrl',
  'profile_image',
  'profileImage',
  'logoUrl',
  'logo_url',
  'avatarUrl',
  'avatar_url',
  'thumbnailUrl',
  'thumbnail_url',
  'imageUrl',
  'image_url',
  'vendorPhoto',
  'vendorProfileImage',
  'businessPhoto',
  'business_photo',
] as const;

export function extractImageFieldsFromRow(row: Record<string, unknown> | null | undefined) {
  if (!row) return {};
  const out: Record<string, unknown> = {};
  for (const k of IMAGE_KEYS) {
    if (k in row && row[k] != null && row[k] !== '') {
      out[k] = row[k];
    }
  }
  return out;
}

export function logDiscoveryImageStage(
  stage: string,
  payload: Record<string, unknown>,
) {
  console.info(WPAY_DISCOVERY_IMAGE_DEBUG_PREFIX, JSON.stringify({ stage, ...payload }));
}
