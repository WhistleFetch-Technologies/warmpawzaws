'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { CouponSection } from '@/components/customer/shared/CouponSection';
import {
  checkCouponAvailability,
  type CouponCheckoutKind,
  type CouponAvailabilityResult,
} from '@/lib/pricing/coupon-capability';
import type { AppliedCheckoutCoupon } from '@/lib/pricing/coupon-validation';

export type CheckoutCouponPanelProps = {
  kind: CouponCheckoutKind;
  vendorId?: string;
  customerId?: string;
  serviceCategory?: string;
  /** Subtotal after auto-promotions — coupon validates against this amount. */
  orderAmount: number;
  appliedCoupon: AppliedCheckoutCoupon | null;
  onApplyCoupon: (coupon: AppliedCheckoutCoupon) => void;
  onRemoveCoupon: () => void;
  className?: string;
  /** Set false when the downstream payment API cannot accept couponCode. */
  paymentSupportsCoupon?: boolean;
  /** Always show coupon input on booking summary (policy-driven messages when unavailable). */
  alwaysShow?: boolean;
};

export function CheckoutCouponPanel({
  kind,
  vendorId,
  customerId,
  serviceCategory,
  orderAmount,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  className = '',
  paymentSupportsCoupon = true,
  alwaysShow = false,
}: CheckoutCouponPanelProps) {
  const [availability, setAvailability] = useState<CouponAvailabilityResult | null>(null);
  const [loading, setLoading] = useState(true);

  const probe = useCallback(async () => {
    setLoading(true);
    const result = await checkCouponAvailability({
      kind,
      vendorId,
      serviceCategory,
      paymentSupportsCoupon,
    });
    setAvailability(result);
    setLoading(false);
  }, [kind, vendorId, serviceCategory, paymentSupportsCoupon]);

  useEffect(() => {
    void probe();
  }, [probe]);

  if (loading) {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500 ${className}`}
      >
        <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
        Checking coupon availability…
      </div>
    );
  }

  if (!availability?.available) {
    if (alwaysShow && kind === 'service_booking') {
      return (
        <CouponSection
          vendorId={vendorId}
          customerId={customerId}
          serviceCategory={serviceCategory}
          orderAmount={orderAmount}
          orderType="booking"
          appliedCoupon={appliedCoupon}
          onApplyCoupon={onApplyCoupon}
          onRemoveCoupon={onRemoveCoupon}
          className={className}
          unavailableMessage={
            availability?.message ??
            'Enter a coupon code — savings depend on your current promotion.'
          }
        />
      );
    }
    if (!availability?.message) return null;
    return (
      <div
        className={`rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600 ${className}`}
        role="status"
      >
        <p>{availability.message}</p>
        {!availability.probed && (
          <button
            type="button"
            onClick={() => void probe()}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        )}
      </div>
    );
  }

  const orderType = kind === 'product_order' ? 'order' : kind === 'meal' ? 'meal' : 'booking';

  return (
    <CouponSection
      vendorId={vendorId}
      customerId={customerId}
      serviceCategory={serviceCategory}
      orderAmount={orderAmount}
      orderType={orderType}
      appliedCoupon={appliedCoupon}
      onApplyCoupon={onApplyCoupon}
      onRemoveCoupon={onRemoveCoupon}
      className={className}
    />
  );
}
