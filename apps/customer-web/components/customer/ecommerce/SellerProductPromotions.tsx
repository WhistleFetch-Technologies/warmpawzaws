'use client';

import { useEffect, useState } from 'react';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import {
  fetchVendorProductPromotions,
  formatSellerPromoHeadline,
  type VendorProductPromotion,
} from '@/lib/ecommerce/seller-promotions';
import { PromoOffersSection } from '@/components/customer/shared/PromotionBadge';
import { Gift, Tag } from 'lucide-react';
import { toast } from 'sonner';

type SellerProductPromotionsProps = {
  vendorId?: string;
  vendorName?: string;
  className?: string;
};

/**
 * Read-only seller offers on product detail (marketplace).
 * Does not alter cart, checkout, or platform `/promotions`.
 */
export function SellerProductPromotions({
  vendorId,
  vendorName,
  className = '',
}: SellerProductPromotionsProps) {
  const [promotions, setPromotions] = useState<VendorProductPromotion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isCustomerEcommerceEnabled() || !vendorId) {
      setPromotions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await fetchVendorProductPromotions(vendorId);
      if (!cancelled) {
        setPromotions(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  if (!isCustomerEcommerceEnabled() || !vendorId) return null;
  if (loading) {
    return (
      <div className={`rounded-xl border border-orange-100 bg-orange-50/50 p-3 animate-pulse ${className}`}>
        <div className="h-4 w-40 bg-orange-100 rounded" />
        <div className="h-3 w-full bg-orange-50 rounded mt-2" />
      </div>
    );
  }
  if (promotions.length === 0) return null;

  const top = promotions[0];
  const headline = formatSellerPromoHeadline(top);

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      toast.success('Coupon copied — apply at checkout');
    }
  };

  return (
    <div className={className}>
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white">
          {top.promotion_type === 'buy_x_get_y' ? (
            <Gift className="h-4 w-4" />
          ) : (
            <Tag className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-purple-700">
            {vendorName ? `Offer from ${vendorName}` : 'Store offer'}
          </p>
          <p className="text-sm font-bold text-slate-900">{headline}</p>
          {top.description && (
            <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{top.description}</p>
          )}
          {top.code && (
            <p className="text-xs text-slate-500 mt-1">
              Code <span className="font-mono font-semibold text-slate-800">{top.code}</span>
              {top.promotion_type === 'buy_x_get_y'
                ? ' · Auto-applies in cart when eligible'
                : ' · Use at checkout'}
            </p>
          )}
        </div>
      </div>
      {promotions.length > 1 && (
        <PromoOffersSection
          promotions={promotions.slice(1)}
          onApplyCoupon={handleCopyCode}
        />
      )}
    </div>
  );
}
