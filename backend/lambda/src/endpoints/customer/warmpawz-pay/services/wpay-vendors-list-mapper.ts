import { getVendorListingPhotoUrl } from '../../../../utils/vendor-listing-photo';
import { mapWithConcurrency } from '../../../../services/image';
import { isPricingCurrentlyEffective } from '../../../warmpawz-pay/shared/pricing/pricing-effective';
import { resolveMerchantDisplayName } from '../../../warmpawz-pay/shared/merchant/merchant-display-name.resolver';
import { resolveMerchantServiceCategory } from '../../../warmpawz-pay/shared/merchant/merchant-service-category.resolver';
import type { WpayVendorListDbRow } from '../repos/wpay-vendors-list.repo';

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

function resolveDiscountPercent(row: WpayVendorListDbRow): number {
  const value = row.pricing_discount_value != null ? Number(row.pricing_discount_value) : 0;
  const effective = isPricingCurrentlyEffective({
    status: String(row.pricing_status ?? 'disabled') as 'active' | 'disabled',
    effectiveFrom: row.pricing_effective_from ? new Date(row.pricing_effective_from) : new Date(0),
    effectiveUntil: row.pricing_effective_until ? new Date(row.pricing_effective_until) : null,
    discountValue: Number.isFinite(value) ? value : 0,
  });
  return effective && Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
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
      discountPercent: resolveDiscountPercent(row),
      category: categoryMeta.serviceCategoryId !== 'unknown' ? categoryMeta.serviceCategoryId : null,
    };
  });
}
