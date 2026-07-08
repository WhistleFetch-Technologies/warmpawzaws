'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchBookingDiscountQuote } from '@/lib/service-booking-pricing';
import { deriveBookingDiscountFromQuote } from '@/lib/pricing/booking-discount-state';
import { totalSavingsFromQuote } from '@/lib/pricing/unified-resolver-response';
import type { UnifiedResolverResponse } from '@/lib/pricing/unified-resolver-response';
import { PriceDisplay } from '@/components/customer/pricing/PriceDisplay';
import { PromotionCard } from '@/components/customer/pricing/PromotionCard';
import { SavingsBadge } from '@/components/customer/pricing/SavingsBadge';
import { formatInr } from '@/lib/pricing/format';
import type { AppliedPromotionOffer } from '@/lib/pricing/types';

type ServiceBookingPromoSummaryProps = {
  vendorId?: string;
  customerId?: string | null;
  serviceIds: string[];
  baseAmount: number;
  serviceStyle?: string;
  serviceCategory?: string;
  className?: string;
  onQuote?: (quote: { totalSavings: number; finalAmount: number }) => void;
  /** When set, display uses this quote only (no separate fetch). */
  quote?: UnifiedResolverResponse | null;
  /** Active coupon code — used with `quote` for Best Offer display. */
  couponCode?: string | null;
  /** When parent owns loading state. */
  loading?: boolean;
};

/**
 * Server-side promotion quote for booking summary.
 * Pass `quote` from the parent resolver so promo/coupon never show stale combined state.
 */
export function ServiceBookingPromoSummary({
  vendorId,
  customerId,
  serviceIds,
  baseAmount,
  serviceStyle,
  serviceCategory,
  className = '',
  onQuote,
  quote: externalQuote,
  couponCode,
  loading: externalLoading,
}: ServiceBookingPromoSummaryProps) {
  const [internalQuote, setInternalQuote] = useState<UnifiedResolverResponse | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);

  const quote = externalQuote !== undefined ? externalQuote : internalQuote;
  const loading = externalLoading ?? internalLoading;

  useEffect(() => {
    if (externalQuote !== undefined) return;
    if (!vendorId || baseAmount <= 0) {
      setInternalQuote(null);
      return;
    }

    let cancelled = false;
    setInternalLoading(true);

    fetchBookingDiscountQuote({
      vendorId,
      customerId: customerId || undefined,
      serviceIds,
      amount: baseAmount,
      serviceStyle,
      serviceCategory,
      displayPromotionsOnly: true,
    })
      .then((q) => {
        if (!cancelled) setInternalQuote(q);
      })
      .catch(() => {
        if (!cancelled) setInternalQuote(null);
      })
      .finally(() => {
        if (!cancelled) setInternalLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    externalQuote,
    vendorId,
    customerId,
    serviceIds.join(','),
    baseAmount,
    serviceStyle,
    serviceCategory,
  ]);

  const derived = useMemo(
    () => deriveBookingDiscountFromQuote(quote, { couponCode }),
    [quote, couponCode]
  );

  const discount = derived?.totalSavings ?? (quote ? totalSavingsFromQuote(quote) : 0);
  const finalAmount =
    derived?.quote.savings?.finalAmount ??
    quote?.savings?.finalAmount ??
    Math.max(0, baseAmount - discount);

  const offers: AppliedPromotionOffer[] = useMemo(() => {
    if (!derived) return [];
    if (derived.couponWins && derived.appliedCoupon) {
      return [
        {
          id: derived.appliedCoupon.promotionId ?? derived.appliedCoupon.code,
          name: derived.appliedCoupon.label ?? derived.appliedCoupon.code,
          source: 'platform',
          discountAmount: derived.appliedCoupon.discountAmount,
          autoApply: false,
        },
      ];
    }
    return derived.uiPromotions.map((p) => ({
      id: p.id,
      name: p.title,
      source: p.type === 'spotlight' ? 'platform' : 'vendor',
      discountAmount: p.discountAmount,
      autoApply: true,
    }));
  }, [derived]);

  useEffect(() => {
    if (!quote) return;
    onQuote?.({ totalSavings: discount, finalAmount });
  }, [quote, discount, finalAmount, onQuote]);

  const hasOffer = discount > 0;

  if (!vendorId || baseAmount <= 0) return null;

  return (
    <div className={`space-y-3 border-t border-gray-100 pt-3 ${className}`}>
      {loading ? (
        <p className="text-xs text-gray-500">Checking offers…</p>
      ) : hasOffer ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SavingsBadge variant="save_amount" amount={discount} />
            {derived?.couponWins ? (
              <SavingsBadge variant="auto_applied" label="Coupon applied" />
            ) : (
              <SavingsBadge variant="auto_applied" />
            )}
          </div>
          {derived?.couponWins && derived.skippedAutoPromoName ? (
            <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-2 py-1.5">
              {derived.skippedAutoPromoName} was not applied — your coupon saves more under Best
              Offer.
            </p>
          ) : null}
          {offers.map((offer) => (
            <PromotionCard key={offer.id} offer={offer} compact />
          ))}
          <PriceDisplay
            originalPrice={baseAmount}
            currentPrice={finalAmount}
            size="md"
            showDiscountPercent
          />
          <p className="text-xs text-gray-500">
            Estimated savings {formatInr(discount)} · Taxes and fees at payment
          </p>
        </>
      ) : (
        <p className="text-xs text-gray-500">Fees & taxes calculated at payment</p>
      )}
    </div>
  );
}
