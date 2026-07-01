'use client';

import { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { fetchBookingPromotionStack } from '@/lib/service-booking-pricing';

type ServiceBookingPromoSummaryProps = {
  vendorId?: string;
  customerId?: string | null;
  serviceIds: string[];
  baseAmount: number;
  serviceStyle?: string;
  serviceCategory?: string;
  className?: string;
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
}: ServiceBookingPromoSummaryProps) {
  const [discount, setDiscount] = useState(0);
  const [finalAmount, setFinalAmount] = useState(baseAmount);
  const [labels, setLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!vendorId || baseAmount <= 0) {
      setDiscount(0);
      setFinalAmount(baseAmount);
      setLabels([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchBookingPromotionStack({
      vendorId,
      customerId: customerId || undefined,
      serviceIds,
      amount: baseAmount,
      serviceStyle,
      serviceCategory,
    })
      .then((res) => {
        if (cancelled) return;
        const savings = res?.totalSavings ?? 0;
        setDiscount(savings);
        setFinalAmount(res?.finalAmount ?? Math.max(0, baseAmount - savings));
        setLabels((res?.applied || []).map((a) => a.name).filter(Boolean));
      })
      .catch(() => {
        if (!cancelled) {
          setDiscount(0);
          setFinalAmount(baseAmount);
          setLabels([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vendorId, customerId, serviceIds.join(','), baseAmount, serviceStyle, serviceCategory]);

  if (!vendorId || baseAmount <= 0) return null;

  return (
    <div className={`space-y-2 border-t border-gray-100 pt-3 ${className}`}>
      {loading ? (
        <p className="text-xs text-gray-500">Checking offers…</p>
      ) : discount > 0 ? (
        <>
          {labels.map((label) => (
            <div key={label} className="flex items-center justify-between text-sm text-green-700">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                {label}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Promotion savings</span>
            <span className="font-medium text-green-600">-{formatPriceWithSymbol(discount)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold">
            <span>You pay</span>
            <span className="text-orange-600">{formatPriceWithSymbol(finalAmount)}</span>
          </div>
          <p className="text-xs text-gray-500">Taxes and fees calculated at payment.</p>
        </>
      ) : null}
    </div>
  );
}
