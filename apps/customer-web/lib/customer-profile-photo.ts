/**
 * Resolve customer profile photo URL/key from API payloads and localStorage shapes.
 */

export const CUSTOMER_PROFILE_UPDATED_EVENT = 'warmpawz-customer-profile-updated';

export function pickCustomerProfilePhoto(
  record: Record<string, unknown> | null | undefined
): string {
  if (!record) return '';
  const candidates = [
    record.photo,
    record.profile_photo_url,
    record.profilePhoto,
    record.profilePhotoUrl,
    record.profile_image_url,
  ];
  for (const c of candidates) {
    const s = String(c ?? '').trim();
    if (s) return s;
  }
  return '';
}

/** Prefer stable S3 key for DB persistence; fall back to presigned/public URL. */
export function photoValueFromUploadResult(result: {
  imageKey?: string;
  fileName?: string;
  publicUrl?: string;
  url?: string;
}): string {
  return (
    String(result.imageKey || result.fileName || result.publicUrl || result.url || '').trim()
  );
}

export function notifyCustomerProfileUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CUSTOMER_PROFILE_UPDATED_EVENT));
}
