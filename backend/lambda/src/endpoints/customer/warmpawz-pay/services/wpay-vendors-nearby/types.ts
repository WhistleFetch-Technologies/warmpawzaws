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
  warmpawzPayEligible: true;
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
};
