/** Response contract for GET /customer/warmpawz-pay/vendors/nearby (PR-1 scaffold). */

export type WpayHomeVendorCardDto = {
  vendorId: string;
  name: string;
  photoUrl: string | null;
  category: string;
  categoryLabel: string;
  rating: number;
  reviewCount: number;
  distanceKm: number | null;
  distanceText: string | null;
  warmpawzPayEligible: boolean;
  appointmentEligible: boolean;
  effectiveRadiusKm?: number | null;
  radiusSource?: 'walk_in_at_center_50km' | 'vendor_service_radius' | 'walk_in_mixed_style_union' | null;
  discountPercent: number;
  payViaWarmpawzLabel?: string;
  fromPrice?: number;
  priceLabel?: string;
  profilePath: {
    vertical: string;
    serviceStyle: string;
  };
};

export type WpayVendorsNearbyGetResponse = {
  success: true;
  vendors: WpayHomeVendorCardDto[];
  total: number;
  nextCursor: string | null;
  appliedFilters: {
    atCenterRadiusKm: 50;
    queryTightenKm: number | null;
    category?: string | null;
    limit: number;
  };
};
