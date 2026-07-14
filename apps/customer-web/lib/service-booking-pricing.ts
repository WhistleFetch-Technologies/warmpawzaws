/**
 * Server-side booking discount quote — unified resolver response.
 */
import { apiClient } from '@/lib/api-client';
import {
  normalizeUnifiedQuote,
  type UnifiedResolverResponse,
} from '@/lib/pricing/unified-resolver-response';

const promoStackInflight = new Map<string, Promise<UnifiedResolverResponse | null>>();
const promoStackCache = new Map<string, UnifiedResolverResponse | null>();

function promoStackCacheKey(params: {
  vendorId: string;
  serviceIds: string[];
  amount: number;
  customerId?: string;
  serviceStyle?: string;
  serviceCategory?: string;
  couponCode?: string;
  displayPromotionsOnly?: boolean;
}): string {
  const ids = [...params.serviceIds].map(String).sort().join(',');
  return [
    params.vendorId,
    params.amount,
    params.serviceCategory ?? '',
    params.serviceStyle ?? '',
    params.customerId ?? '',
    params.couponCode ?? '',
    params.displayPromotionsOnly ? 'promo-only' : 'full',
    ids,
  ].join('|');
}

export type BookingDiscountQuoteParams = {
  vendorId: string;
  serviceIds: string[];
  amount: number;
  customerId?: string;
  serviceStyle?: string;
  serviceCategory?: string;
  /** When set, resolver evaluates coupon per published policy. */
  couponCode?: string;
  /** Service listing / detail — promos only, no coupon. */
  displayPromotionsOnly?: boolean;
  /** Skip in-memory cache (e.g. after coupon apply). */
  bypassCache?: boolean;
  debugSessionId?: string;
};

export async function fetchBookingDiscountQuote(
  params: BookingDiscountQuoteParams
): Promise<UnifiedResolverResponse | null> {
  const key = promoStackCacheKey(params);
  if (!params.bypassCache) {
    const cached = promoStackCache.get(key);
    if (cached !== undefined) return cached;
    const inflight = promoStackInflight.get(key);
    if (inflight) return inflight;
  }

  const request = (async () => {
    try {
      const res = await apiClient.post<UnifiedResolverResponse>(
        '/promotions/calculate-booking',
        {
          vendorId: params.vendorId,
          serviceIds: params.serviceIds,
          amount: params.amount,
          customerId: params.customerId,
          serviceStyle: params.serviceStyle,
          serviceCategory: params.serviceCategory,
          couponCode: params.couponCode,
          displayPromotionsOnly: params.displayPromotionsOnly ?? !params.couponCode,
          debugSessionId: params.debugSessionId,
        }
      );
      const normalized = normalizeUnifiedQuote(res);
      if (!params.bypassCache) promoStackCache.set(key, normalized);
      return normalized;
    } catch {
      if (!params.bypassCache) promoStackCache.set(key, null);
      return null;
    } finally {
      if (!params.bypassCache) promoStackInflight.delete(key);
    }
  })();

  if (!params.bypassCache) promoStackInflight.set(key, request);
  return request;
}

/** @deprecated Use fetchBookingDiscountQuote — kept for existing imports. */
export async function fetchBookingPromotionStack(
  params: Omit<BookingDiscountQuoteParams, 'couponCode' | 'bypassCache'>
) {
  return fetchBookingDiscountQuote({ ...params, displayPromotionsOnly: true });
}

export type ServiceBookingQuote = {
  basePrice: number;
  discount: number;
  tax: number;
  finalPrice: number;
  taxBreakdown?: Array<{ name: string; rate: number; amount: number }>;
  appliedPromotions?: Array<{
    id: string;
    type: string;
    name: string;
    discountAmount: number;
  }>;
  vendorPromotionId?: string;
  platformPromotionId?: string;
};

export async function fetchServiceBookingQuote(params: {
  serviceId: string;
  vendorId: string;
  customerId?: string;
  serviceStyle?: string;
  customerState?: string;
  customerCity?: string;
}): Promise<ServiceBookingQuote | null> {
  try {
    const res = await apiClient.post<ServiceBookingQuote & { success?: boolean }>(
      '/customer/pricing/quote',
      {
        serviceId: params.serviceId,
        vendorId: params.vendorId,
        customerId: params.customerId,
        serviceStyle: params.serviceStyle,
        customerState: params.customerState,
        customerCity: params.customerCity,
      }
    );
    if ((res as { success?: boolean }).success === false) return null;
    return res as ServiceBookingQuote;
  } catch {
    return null;
  }
}

export function clearBookingDiscountQuoteCache(): void {
  promoStackCache.clear();
  promoStackInflight.clear();
}
