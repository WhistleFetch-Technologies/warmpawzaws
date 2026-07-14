'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchBookingDiscountQuote,
  type BookingDiscountQuoteParams,
} from '@/lib/service-booking-pricing';
import {
  deriveBookingDiscountFromQuote,
  syncBookingDiscountStateFromQuote,
  type BookingDiscountDerived,
} from '@/lib/pricing/booking-discount-state';
import type { AppliedCheckoutCoupon } from '@/lib/pricing/coupon-validation';
import type { UnifiedResolverResponse } from '@/lib/pricing/unified-resolver-response';

export type UseBookingDiscountResolverParams = Omit<
  BookingDiscountQuoteParams,
  'couponCode' | 'displayPromotionsOnly' | 'bypassCache'
> & {
  /** When false, skip automatic initial quote fetch. */
  enabled?: boolean;
};

export type UseBookingDiscountResolverResult = {
  quote: UnifiedResolverResponse | null;
  derived: BookingDiscountDerived | null;
  loading: boolean;
  activeCouponCode: string | null;
  appliedCoupon: AppliedCheckoutCoupon | null;
  refresh: (couponCode?: string) => Promise<UnifiedResolverResponse | null>;
  applyCouponFromQuote: (
    quote: UnifiedResolverResponse,
    couponCode: string
  ) => BookingDiscountDerived | null;
  removeCoupon: () => Promise<UnifiedResolverResponse | null>;
};

/**
 * Hook: one resolver quote drives promo summary, coupon state, and checkout amounts.
 */
export function useBookingDiscountResolver(
  params: UseBookingDiscountResolverParams
): UseBookingDiscountResolverResult {
  const {
    enabled = true,
    vendorId,
    serviceIds,
    amount,
    customerId,
    serviceStyle,
    serviceCategory,
  } = params;

  const serviceIdsKey = useMemo(
    () => [...serviceIds].map(String).sort().join(','),
    [serviceIds]
  );

  const [quote, setQuote] = useState<UnifiedResolverResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeCouponCode, setActiveCouponCode] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCheckoutCoupon | null>(null);

  const derived = useMemo(
    () => deriveBookingDiscountFromQuote(quote, { couponCode: activeCouponCode }),
    [quote, activeCouponCode]
  );

  const syncFromQuote = useCallback(
    (nextQuote: UnifiedResolverResponse | null, couponCode?: string | null) => {
      const code = couponCode?.trim().toUpperCase() ?? null;
      setActiveCouponCode(code);
      syncBookingDiscountStateFromQuote(nextQuote, {
        couponCode: code,
        setQuote,
        setPromotions: () => {},
        setAppliedPromotion: () => {},
        setAppliedCoupon,
      });
    },
    []
  );

  const refresh = useCallback(
    async (couponCode?: string) => {
      if (!vendorId || amount <= 0) {
        syncFromQuote(null);
        return null;
      }
      setLoading(true);
      try {
        const next = await fetchBookingDiscountQuote({
          vendorId,
          serviceIds,
          amount,
          customerId,
          serviceStyle,
          serviceCategory,
          couponCode,
          displayPromotionsOnly: !couponCode,
          bypassCache: Boolean(couponCode),
        });
        syncFromQuote(next, couponCode ?? null);
        return next;
      } catch {
        return null;
      } finally {
        setLoading(false);
      }
    },
    [
      vendorId,
      serviceIds,
      amount,
      customerId,
      serviceStyle,
      serviceCategory,
      syncFromQuote,
    ]
  );

  const applyCouponFromQuote = useCallback(
    (nextQuote: UnifiedResolverResponse, couponCode: string) => {
      const code = couponCode.trim().toUpperCase();
      setActiveCouponCode(code);
      setQuote(nextQuote);
      const next = deriveBookingDiscountFromQuote(nextQuote, { couponCode: code });
      setAppliedCoupon(next?.appliedCoupon ?? null);
      return next;
    },
    []
  );

  const removeCoupon = useCallback(async () => {
    setActiveCouponCode(null);
    return refresh(undefined);
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !vendorId || amount <= 0) return;
    if (activeCouponCode) return;
    void refresh();
  }, [
    enabled,
    vendorId,
    amount,
    serviceIdsKey,
    serviceStyle,
    serviceCategory,
    customerId,
    activeCouponCode,
    refresh,
  ]);

  return {
    quote,
    derived,
    loading,
    activeCouponCode,
    appliedCoupon,
    refresh,
    applyCouponFromQuote,
    removeCoupon,
  };
}
