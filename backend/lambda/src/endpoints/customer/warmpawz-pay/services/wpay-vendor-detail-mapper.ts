import { getVendorListingPhotoUrl } from '../../../../utils/vendor-listing-photo';
import type { WpayVendorListDbRow } from '../repos/wpay-vendors-list.repo';
import type { WpayVendorReviewStats } from '../repos/wpay-vendor-reviews.repo';
import {
  type WpayVendorCardDto,
} from './wpay-vendors-list-mapper';
import { mapWpayVendorListRows } from './wpay-vendors-list-mapper';

export type WpayVendorDetailDto = WpayVendorCardDto & {
  rating: number;
  reviewCount: number;
  maxDiscountAmount: number | null;
  offerLabel: string;
};

function buildOfferLabel(discountPercent: number): string {
  if (discountPercent <= 0) return 'Pay with Warmpawz Pay';
  return `Get ${discountPercent}% OFF on your bill`;
}

export async function mapWpayVendorDetailRow(
  row: WpayVendorListDbRow,
  reviews: WpayVendorReviewStats
): Promise<WpayVendorDetailDto> {
  const [card] = await mapWpayVendorListRows([row]);
  const photoUrl =
    card.photoUrl ??
    (await getVendorListingPhotoUrl({
      id: row.vendor_id,
      vendor_id: row.vendor_id,
      vendor_type: row.vendor_type,
      profile_photo_url: row.profile_photo_url,
      metadata: row.metadata,
    }));

  return {
    ...card,
    photoUrl,
    rating: reviews.rating,
    reviewCount: reviews.reviewCount,
    maxDiscountAmount: null,
    offerLabel: buildOfferLabel(card.discountPercent),
  };
}
