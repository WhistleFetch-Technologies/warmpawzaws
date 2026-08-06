import { formatDistanceKm } from '../../../../lib/utils/vendor-customer-distance';
import { getVendorListingPhotoUrl } from '../../../../utils/vendor-listing-photo';
import { mapWithConcurrency } from '../../../../services/image';
import { resolveMerchantDisplayName } from '../../../warmpawz-pay/shared/merchant/merchant-display-name.resolver';
import { resolveMerchantServiceCategory } from '../../../warmpawz-pay/shared/merchant/merchant-service-category.resolver';
import { resolveWpayDiscountPercent } from '../shared/wpay-discount';
import type { WpayVendorsNearbyDbRow } from '../repos/wpay-vendors-nearby.repo';
import { WPAY_LIST_PHOTO_CONCURRENCY } from './wpay-vendors-list-mapper';
import type { WpayHomeVendorCardDto } from './wpay-vendors-nearby/types';

function normalizeNearbyProfileServiceStyle(raw: unknown): 'at_center' | 'at_home' | null {
  const style = String(raw ?? '').trim().toLowerCase();
  if (style === 'at_home' || style === 'home_visit') return 'at_home';
  if (style === 'at_center' || style === 'at_clinic' || style === 'at_vendor') return 'at_center';
  return null;
}

function resolveNearbyProfileServiceStyle(row: WpayVendorsNearbyDbRow): 'at_center' | 'at_home' {
  const fromServices = normalizeNearbyProfileServiceStyle(row.preferred_service_style);
  if (fromServices) return fromServices;

  const vendorType = String(row.vendor_type ?? '').toLowerCase();
  const roleHaystack = `${row.role_display_name ?? ''} ${row.role_name ?? ''}`.toLowerCase();

  const homeHint =
    vendorType === 'solo' ||
    roleHaystack.includes('solo') ||
    roleHaystack.includes('home visit') ||
    roleHaystack.includes('at home') ||
    roleHaystack.includes('home grooming') ||
    roleHaystack.includes('home vet');

  if (homeHint) return 'at_home';

  const centerHint =
    roleHaystack.includes('center') ||
    roleHaystack.includes('centre') ||
    roleHaystack.includes('clinic') ||
    roleHaystack.includes('salon');

  if (centerHint) return 'at_center';

  return 'at_center';
}

function mapRating(raw: unknown): number {
  const rating = Number(raw ?? 0);
  return Number.isFinite(rating) ? Math.round(rating * 10) / 10 : 0;
}

function mapReviewCount(raw: unknown): number {
  const count = Number(raw ?? 0);
  return Number.isFinite(count) ? Math.trunc(count) : 0;
}

function mapDistanceKm(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const km = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(km) || km < 0) return null;
  return Math.round(km * 100) / 100;
}

function buildPayViaWarmpawzLabel(discountPercent: number): string {
  if (discountPercent <= 0) return 'Pay with Warmpawz Pay';
  return `Get ${discountPercent}% OFF on your bill`;
}

export async function mapWpayVendorsNearbyRows(
  rows: WpayVendorsNearbyDbRow[]
): Promise<WpayHomeVendorCardDto[]> {
  const photos = await mapWithConcurrency(rows, WPAY_LIST_PHOTO_CONCURRENCY, async (row) => {
    return getVendorListingPhotoUrl({
      id: row.vendor_id,
      vendor_id: row.vendor_id,
      vendor_type: row.vendor_type,
      profile_photo_url: row.profile_photo_url,
      metadata: row.metadata,
    });
  });

  return rows.map((row, index) => {
    const categoryMeta = resolveMerchantServiceCategory({
      customerService: row.customer_service,
      roleCategory: row.role_category,
      roleConfig: row.role_config,
      legacyCategory: row.legacy_category,
      roleName: row.role_name,
      roleDisplayName: row.role_display_name,
    });

    const category =
      categoryMeta.serviceCategoryId !== 'unknown' ? categoryMeta.serviceCategoryId : 'unknown';
    const discountPercent = resolveWpayDiscountPercent(row);
    const distanceKm = mapDistanceKm(row.distance_km);
    const distanceText =
      distanceKm != null ? formatDistanceKm(distanceKm, false) : null;
    const profileServiceStyle = resolveNearbyProfileServiceStyle(row);

    return {
      vendorId: row.vendor_id,
      name: resolveMerchantDisplayName({
        businessName: row.business_name,
        ownerName: row.owner_name,
        vendorType: row.vendor_type,
        isSoloProvider: String(row.vendor_type ?? '').toLowerCase() === 'solo',
      }),
      photoUrl: photos[index] ?? null,
      category,
      categoryLabel: categoryMeta.categoryDisplay,
      rating: mapRating(row.avg_rating),
      reviewCount: mapReviewCount(row.review_count),
      distanceKm,
      distanceText,
      warmpawzPayEligible: true as const,
      discountPercent,
      payViaWarmpawzLabel: buildPayViaWarmpawzLabel(discountPercent),
      profilePath: {
        vertical: category,
        serviceStyle: profileServiceStyle,
      },
    };
  });
}
