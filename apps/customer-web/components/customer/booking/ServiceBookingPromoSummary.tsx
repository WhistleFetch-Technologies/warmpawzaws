'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchBookingDiscountQuote } from '@/lib/service-booking-pricing';
import { totalSavingsFromQuote } from '@/lib/pricing/unified-resolver-response';
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
};

/**
 * Server-side promotion quote for booking summary (auto-apply only).
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
}: ServiceBookingPromoSummaryProps) {
  const [discount, setDiscount] = useState(0);
  const [finalAmount, setFinalAmount] = useState(baseAmount);
  const [offers, setOffers] = useState<AppliedPromotionOffer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!vendorId || baseAmount <= 0) {
      setDiscount(0);
      setFinalAmount(baseAmount);
      setOffers([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchBookingDiscountQuote({
      vendorId,
      customerId: customerId || undefined,
      serviceIds,
      amount: baseAmount,
      serviceStyle,
      serviceCategory,
      displayPromotionsOnly: true,
    })
      .then((quote) => {
        if (cancelled || !quote) return;
        const savings = totalSavingsFromQuote(quote);
        setDiscount(savings);
        setFinalAmount(quote.savings?.finalAmount ?? Math.max(0, baseAmount - savings));
        setOffers(
          quote.appliedOffers
            .filter((o) => o.trigger === 'AUTO')
            .slice(0, 1)
            .map((winner) => ({
              id: winner.id,
              name: winner.name,
              source: winner.source === 'platform' ? 'platform' : 'vendor',
              discountAmount: winner.discountAmount,
              autoApply: true,
            }))
        );
        onQuote?.({
          totalSavings: savings,
          finalAmount: quote.savings?.finalAmount ?? Math.max(0, baseAmount - savings),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setDiscount(0);
          setFinalAmount(baseAmount);
          setOffers([]);
          onQuote?.({ totalSavings: 0, finalAmount: baseAmount });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vendorId, customerId, serviceIds.join(','), baseAmount, serviceStyle, serviceCategory, onQuote]);

  const hasPromo = useMemo(() => discount > 0, [discount]);

  if (!vendorId || baseAmount <= 0) return null;

  return (
    <div className={`space-y-3 border-t border-gray-100 pt-3 ${className}`}>
      {loading ? (
        <p className="text-xs text-gray-500">Checking offers…</p>
      ) : hasPromo ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SavingsBadge variant="save_amount" amount={discount} />
            <SavingsBadge variant="auto_applied" />
          </div>
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
