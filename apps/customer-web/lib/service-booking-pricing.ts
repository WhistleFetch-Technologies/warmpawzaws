/**
 * Server-side booking price quote (promotions auto-applied).
 */
import { apiClient } from '@/lib/api-client';

type BookingPromoStackResponse = {
  success?: boolean;
  totalSavings?: number;
  finalAmount?: number;
  vendorPromotionId?: string;
  platformPromotionId?: string;
  vendorDiscountAmount?: number;
  platformDiscountAmount?: number;
  applied?: Array<{ source: string; id: string; name: string; discountAmount: number }>;
};

const promoStackInflight = new Map<string, Promise<BookingPromoStackResponse | null>>();
const promoStackCache = new Map<string, BookingPromoStackResponse | null>();

function promoStackCacheKey(params: {
  vendorId: string;
  serviceIds: string[];
  amount: number;
  customerId?: string;
  serviceStyle?: string;
  serviceCategory?: string;
}): string {
  const ids = [...params.serviceIds].map(String).sort().join(',');
  return [
    params.vendorId,
    params.amount,
    params.serviceCategory ?? '',
    params.serviceStyle ?? '',
    params.customerId ?? '',
    ids,
  ].join('|');
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

export async function fetchBookingPromotionStack(params: {
  vendorId: string;
  serviceIds: string[];
  amount: number;
  customerId?: string;
  serviceStyle?: string;
  serviceCategory?: string;
}) {
  const key = promoStackCacheKey(params);
  const cached = promoStackCache.get(key);
  if (cached !== undefined) return cached;

  const inflight = promoStackInflight.get(key);
  if (inflight) return inflight;

  const request = (async () => {
    try {
      const res = await apiClient.post<BookingPromoStackResponse>(
        '/promotions/calculate-booking',
        params
      );
      promoStackCache.set(key, res);
      return res;
    } catch {
      promoStackCache.set(key, null);
      return null;
    } finally {
      promoStackInflight.delete(key);
    }
  })();

  promoStackInflight.set(key, request);
  return request;
}
