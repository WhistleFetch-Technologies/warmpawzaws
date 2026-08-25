import type { BoardingListVendor } from '@/lib/boarding-vendor-discovery-map';

/** Marketplace discover-services / vendors/search leak unpublished WAPPT walkers. */
export function shouldLoadWalkerMarketplaceDiscovery(wapptHubEnabled: boolean): boolean {
  return !wapptHubEnabled;
}

/** Flatten WAPPT featured card rows into WalkerService list-row shape. */
export function wapptFeaturedVendorToWalkerRow(
  vendor: BoardingListVendor,
): Record<string, unknown> {
  const raw =
    vendor.raw && typeof vendor.raw === 'object'
      ? { ...(vendor.raw as Record<string, unknown>) }
      : {};
  const vendorId = String(vendor.id || raw.vendorId || raw.vendor_id || '').trim();
  const id = vendorId || vendor.id;
  return {
    ...raw,
    id,
    vendorId: id,
    vendor_id: id,
    name: vendor.name,
    businessName: vendor.name,
    address: vendor.address || raw.address,
    photo: vendor.photo,
    photoUrl: vendor.photo,
    rating: vendor.rating,
    reviewCount: vendor.review_count,
    isVerified: Boolean(vendor.isVerified),
    warmpawzAppointments: true,
    appointmentsMode: true,
  };
}
