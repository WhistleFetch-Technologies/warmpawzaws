'use client';

import { useEffect, useMemo, useState } from 'react';
import { PriceDisplay } from './PriceDisplay';
import { fetchBookingPromotionStack } from '@/lib/service-booking-pricing';
import { roundMoney } from '@/lib/pricing/format';

export type ServiceListingPriceProps = {
  basePrice: number;
  vendorId?: string;
  serviceId?: string;
  customerId?: string;
  serviceStyle?: string;
  serviceCategory?: string;
  vendorDiscount?: number;
  vendorDiscountAmount?: number;
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
  serviceCategory,
  vendorDiscount,
  vendorDiscountAmount,
  size = 'md',
  className = '',
}: ServiceListingPriceProps) {
  const [loading, setLoading] = useState(false);
  const [quoteCurrent, setQuoteCurrent] = useState<number | null>(null);
  const [quoteSavings, setQuoteSavings] = useState(0);
  const [offerHint, setOfferHint] = useState(false);

  const local = useMemo(
    () => applyVendorDiscount(basePrice, vendorDiscount, vendorDiscountAmount),
    [basePrice, vendorDiscount, vendorDiscountAmount]
  );

  useEffect(() => {
    if (!vendorId || basePrice <= 0) return;
    let cancelled = false;
    setLoading(true);
    fetchBookingPromotionStack({
      vendorId,
      serviceIds: serviceId ? [serviceId] : [],
      amount: basePrice,
      customerId,
      serviceStyle,
      serviceCategory,
    })
      .then((stack) => {
        if (cancelled) return;
        const savings = stack?.totalSavings ?? 0;
        const final = stack?.finalAmount ?? basePrice - savings;
        if (savings > 0 && final < basePrice) {
          setQuoteCurrent(roundMoney(final));
          setQuoteSavings(roundMoney(savings));
          setOfferHint(false);
        } else if ((stack?.applied?.length ?? 0) > 0 || local.savings > 0) {
          setOfferHint(true);
        } else {
          setQuoteCurrent(null);
          setQuoteSavings(0);
        }
      })
      .catch(() => {
        if (!cancelled && local.savings <= 0) setOfferHint(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId, serviceId, basePrice, customerId, serviceStyle, serviceCategory, local.savings]);

  const currentPrice =
    quoteCurrent != null && quoteSavings > 0
      ? quoteCurrent
      : local.savings > 0
        ? local.current
        : basePrice;

  const originalPrice = basePrice;
  const hasPromo = quoteSavings > 0 || local.savings > 0;

  return (
    <div className={className}>
      <PriceDisplay
        originalPrice={originalPrice}
        currentPrice={currentPrice}
        size={size}
        loading={loading && !hasPromo}
        offerAvailable={!hasPromo && offerHint && !loading}
      />
      {!hasPromo && !offerHint && !loading && basePrice > 0 && (
        <p className="mt-0.5 text-[10px] text-slate-400">Fees & taxes at checkout</p>
      )}
    </div>
  );
}
