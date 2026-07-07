import { apiClient } from '@/lib/api-client';
import { couponOfferMatchesService } from '@/lib/pricing/coupon-targeting';

export type CouponCheckoutKind = 'service_booking' | 'product_order' | 'meal';

export type CouponAvailabilityResult = {
  available: boolean;
  message?: string;
  /** When unavailable, whether probe completed successfully (vs network error). */
  probed: boolean;
};

type PromotionRow = {
  code?: string | null;
  promotion_type?: string;
  source?: string;
  applicable_services?: unknown;
  service_category?: string;
};

function hasRedeemableCode(promotions: PromotionRow[]): boolean {
  return promotions.some((p) => typeof p.code === 'string' && p.code.trim().length > 0);
}

async function fetchVendorCodedPromotions(
  vendorId: string,
  promoType: 'service' | 'product'
): Promise<PromotionRow[]> {
  try {
    const res = await apiClient.get<any>(`/vendors/${vendorId}/active-promotions?type=${promoType}`);
    const rows = (res?.promotions || res?.data?.promotions || []) as PromotionRow[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function fetchPlatformCodedOffers(
  serviceCategory?: string
): Promise<PromotionRow[]> {
  try {
    const params = new URLSearchParams({
      includeCoupons: 'true',
      includeCodedPromotions: 'true',
    });
    if (serviceCategory) params.set('service', serviceCategory);
    const res = await apiClient.get<any>(`/promotions/active?${params.toString()}`);
    const rows = (res?.promotions || []) as PromotionRow[];
    if (!Array.isArray(rows)) return [];
    return rows.filter(
      (row) =>
        typeof row.code === 'string' &&
        row.code.trim().length > 0 &&
        couponOfferMatchesService(row, serviceCategory)
    );
  } catch {
    return [];
  }
}

export type CheckCouponAvailabilityParams = {
  kind: CouponCheckoutKind;
  vendorId?: string;
  serviceCategory?: string;
  /** When false, coupon UI is hidden (e.g. package purchase API has no coupon field). */
  paymentSupportsCoupon?: boolean;
};

const UNAVAILABLE_MSG = 'Coupons are not available for this booking';

/**
 * Derives whether manual coupon entry should be shown for a checkout domain.
 * Probes vendor active promotions and platform promotions for redeemable codes.
 * Product checkout is always enabled (existing cart flow).
 */
export async function checkCouponAvailability(
  params: CheckCouponAvailabilityParams
): Promise<CouponAvailabilityResult> {
  if (params.paymentSupportsCoupon === false) {
    return { available: false, message: UNAVAILABLE_MSG, probed: true };
  }

  if (params.kind === 'product_order') {
    return { available: true, probed: true };
  }

  const promoType = params.kind === 'product_order' ? 'product' : 'service';
  const serviceCategory = params.serviceCategory;

  try {
    const [vendorPromos, platformPromos] = await Promise.all([
      params.vendorId ? fetchVendorCodedPromotions(params.vendorId, promoType) : Promise.resolve([]),
      fetchPlatformCodedOffers(serviceCategory),
    ]);

    const available = hasRedeemableCode(vendorPromos) || hasRedeemableCode(platformPromos);

    if (available) {
      return { available: true, probed: true };
    }

    return {
      available: false,
      message: UNAVAILABLE_MSG,
      probed: true,
    };
  } catch {
    return {
      available: false,
      message: 'Unable to check coupon availability. Try again later.',
      probed: false,
    };
  }
}
