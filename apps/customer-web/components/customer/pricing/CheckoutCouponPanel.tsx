'use client';

import { PromoEarnPreview, type PromoEngineEarnPreviewData } from '@/components/customer/promo-engine/PromoEarnPreview';
import type { AppliedCheckoutCoupon } from '@/lib/pricing/coupon-validation';

export type CheckoutCouponPanelProps = {
  kind: 'service_booking' | 'product_order' | 'meal' | string;
  vendorId?: string;
  customerId?: string;
  serviceCategory?: string;
  serviceIds?: string[];
  serviceStyle?: string;
  bookingBaseAmount?: number;
  orderAmount: number;
  appliedCoupon: AppliedCheckoutCoupon | null;
  onApplyCoupon: (
    coupon: AppliedCheckoutCoupon,
    quote?: import('@/lib/pricing/unified-resolver-response').UnifiedResolverResponse
  ) => void;
  onBookingQuote?: (
    quote: import('@/lib/pricing/unified-resolver-response').UnifiedResolverResponse,
    couponCode: string
  ) => void;
  onRemoveCoupon: () => void;
  className?: string;
  paymentSupportsCoupon?: boolean;
  alwaysShow?: boolean;
  promoEngine?: PromoEngineEarnPreviewData | null;
};

/** Coupons are retired — Promotion Engine offers apply automatically. */
export function CheckoutCouponPanel({
  className = '',
  promoEngine,
}: CheckoutCouponPanelProps) {
  return (
    <div className={className}>
      <PromoEarnPreview data={promoEngine} />
      {!promoEngine?.eligible &&
      !(Number(promoEngine?.pendingCashback) > 0) &&
      !(Number(promoEngine?.engineDiscount) > 0) ? (
        <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Offers apply automatically at checkout when you qualify. Coupon codes are no longer used.
        </p>
      ) : null}
    </div>
  );
}
