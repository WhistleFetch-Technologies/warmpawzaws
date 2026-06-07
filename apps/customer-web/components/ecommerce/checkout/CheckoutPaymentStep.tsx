'use client';

import { CreditCard, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCheckout } from '@/context/CheckoutProvider';
import { CouponSection } from '@/components/customer/shared/CouponSection';

export function CheckoutPaymentStep() {
  const {
    pricing,
    paymentMethod,
    selectPayment,
    goNext,
    primaryVendorId,
    coupon,
    applyCoupon,
    removeCoupon,
  } = useCheckout();

  const appliedCouponForUi = coupon
    ? {
        code: coupon.code,
        discountType: 'fixed' as const,
        discountValue: coupon.discountAmount,
        discountAmount: coupon.discountAmount,
        promotionId: coupon.promotionId,
      }
    : null;

  return (
    <div className="space-y-4">
      {primaryVendorId && (
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <CouponSection
            vendorId={primaryVendorId}
            orderAmount={pricing.lineSubtotal}
            orderType="order"
            appliedCoupon={appliedCouponForUi}
            onApplyCoupon={(c) =>
              applyCoupon({
                code: c.code,
                discountAmount: c.discountAmount,
                promotionId: c.promotionId,
              })
            }
            onRemoveCoupon={removeCoupon}
          />
        </section>
      )}

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-3">Payment method</h2>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => selectPayment('online')}
            className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
              paymentMethod === 'online'
                ? 'border-[#FF8C42] bg-orange-50'
                : 'border-slate-100 hover:border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                  paymentMethod === 'online' ? 'bg-[#FF8C42] text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Pay online</p>
                <p className="text-xs text-slate-500">UPI, cards, netbanking via Razorpay</p>
              </div>
              <div
                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === 'online' ? 'border-[#FF8C42]' : 'border-slate-300'
                }`}
              >
                {paymentMethod === 'online' && (
                  <div className="h-2.5 w-2.5 rounded-full bg-[#FF8C42]" />
                )}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => selectPayment('cod')}
            className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
              paymentMethod === 'cod'
                ? 'border-[#FF8C42] bg-orange-50'
                : 'border-slate-100 hover:border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                  paymentMethod === 'cod' ? 'bg-[#FF8C42] text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Wallet className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Cash on delivery</p>
                <p className="text-xs text-slate-500">Pay when your order arrives</p>
              </div>
              <div
                className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === 'cod' ? 'border-[#FF8C42]' : 'border-slate-300'
                }`}
              >
                {paymentMethod === 'cod' && (
                  <div className="h-2.5 w-2.5 rounded-full bg-[#FF8C42]" />
                )}
              </div>
            </div>
          </button>
        </div>
      </section>

      <Button
        type="button"
        onClick={goNext}
        className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A29] text-white font-semibold rounded-xl"
      >
        Continue to review
      </Button>
    </div>
  );
}
