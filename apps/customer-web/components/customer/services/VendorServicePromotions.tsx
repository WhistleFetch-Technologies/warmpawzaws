'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { PromoOffersSection } from '@/components/customer/shared/PromotionBadge';
import { Gift } from 'lucide-react';

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

function formatServicePromoHeadline(promo: VendorServicePromotion): string {
  const val = promo.discount_value ?? 0;
  if (promo.discount_type === 'fixed') return `₹${val} OFF`;
  if (val > 0) return `${val}% OFF`;
  if (promo.promotion_type === 'first_booking') return 'First booking offer';
  if (promo.promotion_type === 'combo') return 'Combo deal';
  return promo.name || 'Special offer';
}

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

  const headlines = promotions.slice(0, 4).map((p) => formatServicePromoHeadline(p));

  return (
    <div className={className}>
      <PromoOffersSection
        icon={Gift}
        title={vendorName ? `Offers from ${vendorName}` : 'Service offers'}
        subtitle="Applied automatically on eligible services at checkout"
        offers={headlines}
      />
    </div>
  );
}
