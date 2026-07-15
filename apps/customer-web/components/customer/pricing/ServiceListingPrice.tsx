'use client';

import { useEffect, useMemo, useState } from 'react';
import { PriceDisplay } from './PriceDisplay';
import { SavingsBadge } from './SavingsBadge';
import { fetchBookingDiscountQuoteBatched } from '@/lib/service-booking-pricing';
import { roundMoney } from '@/lib/pricing/format';
import { totalSavingsFromQuote } from '@/lib/pricing/unified-resolver-response';

export type ServiceListingPriceProps = {
  basePrice: number;
  vendorId?: string;
  serviceId?: string;
  customerId?: string;
  serviceStyle?: string;
  /** Used when service row has no style (featured hub cards). */
  defaultServiceStyle?: string;
  serviceCategory?: string;
  vendorDiscount?: number;
  vendorDiscountAmount?: number;
  /** When true (default), only server quote drives promo display — no local vendorDiscount fallback. */
  promoQuoteOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

function applyVendorDiscount(
  base: number,
  pct?: number,
  fixed?: number
): { current: number; savings: number } {
  let current = base;
  if (fixed != null && fixed > 0) {
    current = Math.max(0, base - fixed);
  } else if (pct != null && pct > 0) {
    current = base * (1 - pct / 100);
  }
  return { current: roundMoney(current), savings: roundMoney(base - current) };
}

export function ServiceListingPrice({
  basePrice,
  vendorId,
  serviceId,
  customerId,
  serviceStyle,
  defaultServiceStyle,
  serviceCategory,
  vendorDiscount,
  vendorDiscountAmount,
  promoQuoteOnly = true,
  size = 'md',
  className = '',
}: ServiceListingPriceProps) {
  const [loading, setLoading] = useState(false);
  const [quoteCurrent, setQuoteCurrent] = useState<number | null>(null);
  const [quoteSavings, setQuoteSavings] = useState(0);
  const [hasAppliedPromo, setHasAppliedPromo] = useState(false);
  const [promoBadgePercent, setPromoBadgePercent] = useState<number | undefined>();
  const effectiveServiceStyle = serviceStyle || defaultServiceStyle;

  const local = useMemo(
    () => applyVendorDiscount(basePrice, vendorDiscount, vendorDiscountAmount),
    [basePrice, vendorDiscount, vendorDiscountAmount]
  );

  useEffect(() => {
    if (!vendorId || basePrice <= 0) return;
    let cancelled = false;
    setLoading(true);
    fetchBookingDiscountQuoteBatched({
      vendorId,
      serviceIds: serviceId ? [serviceId] : [],
      amount: basePrice,
      customerId,
      serviceStyle: effectiveServiceStyle,
      serviceCategory,
    })
      .then((quote) => {
        if (cancelled || !quote) return;
        const savings = totalSavingsFromQuote(quote);
        const final = quote.savings?.finalAmount ?? basePrice - savings;
        const winner = quote.winningPromotion;
        if (savings > 0 && final < basePrice) {
          setQuoteCurrent(roundMoney(final));
          setQuoteSavings(roundMoney(savings));
          setHasAppliedPromo((quote.appliedOffers?.length ?? 0) > 0);
          const stated =
            winner && winner.discountAmount > 0 && savings > 0
              ? Math.round((winner.discountAmount / basePrice) * 100)
              : undefined;
          setPromoBadgePercent(stated);
        } else {
          setQuoteCurrent(null);
          setQuoteSavings(0);
          setHasAppliedPromo(false);
          setPromoBadgePercent(undefined);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuoteCurrent(null);
          setQuoteSavings(0);
          setHasAppliedPromo(false);
          setPromoBadgePercent(undefined);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    vendorId,
    serviceId,
    basePrice,
    customerId,
    effectiveServiceStyle,
    serviceCategory,
  ]);

  const useLocalFallback = !promoQuoteOnly && local.savings > 0;
  const currentPrice =
    quoteCurrent != null && quoteSavings > 0
      ? quoteCurrent
      : useLocalFallback
        ? local.current
        : basePrice;

  const originalPrice = basePrice;
  const savings = quoteSavings > 0 ? quoteSavings : useLocalFallback ? local.savings : 0;
  const hasPromo = savings > 0;

  return (
    <div className={className}>
      <PriceDisplay
        originalPrice={originalPrice}
        currentPrice={currentPrice}
        size={size}
        loading={loading && !hasPromo}
        showDiscountPercent={hasPromo}
        discountPercent={promoBadgePercent}
      />
      {hasPromo && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <SavingsBadge variant="save_amount" amount={savings} />
          {hasAppliedPromo || local.savings > 0 ? (
            <SavingsBadge variant="auto_applied" />
          ) : null}
        </div>
      )}
      {!hasPromo && !loading && basePrice > 0 && (
        <p className="mt-0.5 text-[10px] text-slate-400">Fees & taxes at checkout</p>
      )}
    </div>
  );
}
