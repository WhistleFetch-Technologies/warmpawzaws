import { getVendorListingPhotoUrl } from '../../../../utils/vendor-listing-photo';
import { mapWithConcurrency } from '../../../../services/image';
import { resolveMerchantDisplayName } from '../../../warmpawz-pay/shared/merchant/merchant-display-name.resolver';
import { resolveMerchantServiceCategory } from '../../../warmpawz-pay/shared/merchant/merchant-service-category.resolver';
import type { WpayVendorListDbRow } from '../repos/wpay-vendors-list.repo';
import { resolveWpayListingDiscountPercents } from '../shared/resolve-wpay-listing-discount-percents';

export const WPAY_LIST_PHOTO_CONCURRENCY = 5;

export type WpayVendorCardDto = {
  vendorId: string;
  name: string;
  phone: string | null;
  address: string;
  photoUrl: string | null;
  discountPercent: number;
  category: string | null;
};

export function formatWpayVendorAddress(address: string | null, city: string | null): string {
  const line = String(address ?? '').trim();
  const cityLine = String(city ?? '').trim();
  if (line && cityLine && !line.toLowerCase().includes(cityLine.toLowerCase())) {
    return `${line}, ${cityLine}`;
  }
  return line || cityLine || '';
}

export async function mapWpayVendorListRows(rows: WpayVendorListDbRow[]): Promise<WpayVendorCardDto[]> {
  const photos = await mapWithConcurrency(rows, WPAY_LIST_PHOTO_CONCURRENCY, async (row) => {
    return getVendorListingPhotoUrl({
      id: row.vendor_id,
      vendor_id: row.vendor_id,
      vendor_type: row.vendor_type,
      profile_photo_url: row.profile_photo_url,
      metadata: row.metadata,
    });
  });

  const discountByVendor = await resolveWpayListingDiscountPercents(
    rows.map((row) => row.vendor_id),
  );

  return rows.map((row, index) => {
    const categoryMeta = resolveMerchantServiceCategory({
      customerService: row.customer_service,
      roleCategory: row.role_category,
      roleConfig: row.role_config,
      legacyCategory: row.legacy_category,
      roleName: row.role_name,
      roleDisplayName: row.role_display_name,
    });

    return {
      vendorId: row.vendor_id,
      name: resolveMerchantDisplayName({
        businessName: row.business_name,
        ownerName: row.owner_name,
        vendorType: row.vendor_type,
        isSoloProvider: String(row.vendor_type ?? '').toLowerCase() === 'solo',
      }),
      phone: row.phone,
      address: formatWpayVendorAddress(row.address, row.city),
      photoUrl: photos[index] ?? null,
      discountPercent: discountByVendor.get(row.vendor_id) ?? 0,
      category: categoryMeta.serviceCategoryId !== 'unknown' ? categoryMeta.serviceCategoryId : null,
    };
  });
}
