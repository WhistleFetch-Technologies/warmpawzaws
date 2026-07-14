'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { PromoOffersSection } from '@/components/customer/shared/PromotionBadge';

export type VendorServicePromotion = {
  id: string;
  name: string;
  description?: string;
  promotion_type: string;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  min_booking_value?: number;
  max_discount_amount?: number;
  promo_category?: string;
};

type VendorServicePromotionsProps = {
  vendorId?: string;
  vendorName?: string;
  className?: string;
};

/**
 * Read-only vendor service offers on clinic/profile screens.
 */
export function VendorServicePromotions({
  vendorId,
  vendorName,
  className = '',
}: VendorServicePromotionsProps) {
  const [promotions, setPromotions] = useState<VendorServicePromotion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!vendorId) {
      setPromotions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<{ promotions?: VendorServicePromotion[] }>(
          `/vendors/${vendorId}/active-promotions?type=service`
        );
        if (!cancelled) {
          setPromotions(res?.promotions ?? []);
        }
      } catch {
        if (!cancelled) setPromotions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  if (!vendorId || loading || promotions.length === 0) return null;

  return (
    <div className={className}>
      <PromoOffersSection promotions={promotions} />
    </div>
  );
}
