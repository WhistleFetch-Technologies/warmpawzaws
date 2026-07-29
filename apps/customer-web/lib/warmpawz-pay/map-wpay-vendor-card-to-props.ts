import type { WpayVendorCard } from '@/lib/warmpawz-pay/wpay-api';
import type { WarmpawzPayVendorCardProps } from '@/components/warmpawz-pay/vendor-card/types';
import {
  buildWpayDiscountBadges,
  normalizeWpayVendorCardAddress,
} from '@/lib/warmpawz-pay/wpay-vendor-card-map-utils';

/** Maps Pay Hub list DTO → WarmpawzPayVendorCard props (presentation only). */
export function mapWpayVendorCardToProps(vendor: WpayVendorCard): WarmpawzPayVendorCardProps {
  return {
    name: vendor.name,
    imageUrl: vendor.photoUrl,
    subtitle: vendor.phone ?? undefined,
    address: normalizeWpayVendorCardAddress(vendor.address),
    badges: buildWpayDiscountBadges(vendor.discountPercent),
  };
}
