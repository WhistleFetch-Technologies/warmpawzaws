/**
 * Resolve customer/pet/vendor profile photos for GET handlers (presign + lazy WebP migrate).
 * Persist targets must match entity: customers / pets / vendors photo columns.
 */

import { regeneratePresignedUrl } from '../../endpoints/constants/helper';
import { presignS3GetUrlIfApplicable, stripS3PresignQueryFromUrl } from '../../utils/s3-media-presign';
import { resolveImageForContext } from './image-resolve';

function httpsDisplayUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return /^https?:\/\//i.test(s) ? s : null;
}

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

export type VendorPhotoColumn = 'profile_photo_url' | 'profile_image' | 'logo_url';

/**
 * Vendor profile / logo for vendor-web GETs.
 * Never returns a bare S3 key — only https display URLs (or null).
 */
export async function resolveVendorPhotoForDisplay(
  raw: string | null | undefined,
  vendorId: string,
  column: VendorPhotoColumn = 'profile_photo_url',
): Promise<string | null> {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === 'null' || s === 'undefined') return null;

  const id = String(vendorId || '').trim();
  if (id) {
    const resolved = await resolveImageForContext(s, {
      assetType: 'profile',
      ownerId: id,
      vendorId: id,
      context: 'detail',
      migrate: true,
      persist: {
        kind: 'scalar',
        table: 'vendors',
        column,
        idColumn: 'id',
        id,
      },
    });
    const fromResolve = httpsDisplayUrl(resolved?.displayUrl);
    if (fromResolve) return fromResolve;
  }

  const stripped = stripS3PresignQueryFromUrl(s);
  const fromHelper = httpsDisplayUrl(await regeneratePresignedUrl(stripped));
  if (fromHelper) return fromHelper;

  const fromHost = httpsDisplayUrl(await presignS3GetUrlIfApplicable(stripped));
  if (fromHost) return fromHost;

  return httpsDisplayUrl(s);
}

/** Overwrite photo fields on a vendor row so spreads never leak bare keys. */
export async function overlayVendorDisplayPhotoFields(
  vendor: Record<string, unknown> | null | undefined,
): Promise<Record<string, unknown>> {
  if (!vendor || typeof vendor !== 'object') return {};
  const id = String(vendor.id ?? vendor.vendor_id ?? vendor.vendorId ?? '').trim();
  const photo = await resolveVendorPhotoForDisplay(
    (vendor.profile_photo_url ?? vendor.profilePhotoUrl) as string | null | undefined,
    id,
    'profile_photo_url',
  );
  const profileImage = await resolveVendorPhotoForDisplay(
    (vendor.profile_image ?? vendor.profileImage) as string | null | undefined,
    id,
    'profile_image',
  );
  const logo = await resolveVendorPhotoForDisplay(
    (vendor.logo_url ?? vendor.logoUrl) as string | null | undefined,
    id,
    'logo_url',
  );
  return {
    ...vendor,
    profile_photo_url: photo,
    profilePhotoUrl: photo,
    profile_image: profileImage,
    profileImage: profileImage,
    logo_url: logo,
    logoUrl: logo,
  };
}
