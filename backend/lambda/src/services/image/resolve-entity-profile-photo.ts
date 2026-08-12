/**
 * Resolve customer/pet profile photos for GET handlers (presign + lazy WebP migrate).
 * Persist targets must match entity: customers.profile_photo_url vs pets.profile_photo_url.
 */

import { presignS3GetUrlIfApplicable, stripS3PresignQueryFromUrl } from '../../utils/s3-media-presign';
import { resolveImageForContext } from './image-resolve';

export async function resolveCustomerPhotoForDisplay(
  raw: string | null | undefined,
  customerId?: string,
): Promise<string | null> {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const resolved = await resolveImageForContext(s, {
    assetType: 'profile',
    ownerId: customerId || 'customer',
    context: 'detail',
    migrate: true,
    persist: customerId
      ? {
          kind: 'scalar',
          table: 'customers',
          column: 'profile_photo_url',
          idColumn: 'id',
          id: customerId,
        }
      : null,
  });
  if (resolved?.displayUrl) return resolved.displayUrl;

  const stripped = stripS3PresignQueryFromUrl(s);
  const presigned = await presignS3GetUrlIfApplicable(stripped);
  return presigned || stripped;
}

export async function resolvePetPhotoForDisplay(
  raw: string | null | undefined,
  petId: string,
): Promise<string | null | undefined> {
  if (!raw) return raw;
  const resolved = await resolveImageForContext(String(raw).trim(), {
    assetType: 'pet',
    ownerId: petId,
    context: 'detail',
    migrate: true,
    persist: {
      kind: 'scalar',
      table: 'pets',
      column: 'profile_photo_url',
      idColumn: 'id',
      id: petId,
    },
  });
  return resolved?.displayUrl ?? raw;
}
