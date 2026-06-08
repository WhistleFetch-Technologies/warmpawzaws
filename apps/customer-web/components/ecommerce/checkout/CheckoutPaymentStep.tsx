'use client';

import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCheckout } from '@/context/CheckoutProvider';
import { CartPromotionSelect } from '@/components/ecommerce/cart/CartPromotionSelect';

export function CheckoutPaymentStep() {
  const {
    pricing,
    goNext,
    primaryVendorId,
    coupon,
    applyCoupon,
    removeCoupon,
  } = useCheckout();

  const selectedPromo = coupon
    ? {
        code: coupon.code,
        discountAmount: coupon.discountAmount,
        promotionId: coupon.promotionId,
        label: coupon.code,
      }
    : null;

  return (
    <div className="space-y-4">
      <CartPromotionSelect
        orderAmount={pricing.lineSubtotal}
        vendorId={primaryVendorId}
        selected={selectedPromo}
        onApply={(p) =>
          applyCoupon({
            code: p.code,
            discountAmount: p.discountAmount,
            promotionId: p.promotionId,
          })
        }
        onRemove={removeCoupon}
      />

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-3">Payment method</h2>
        <div className="flex items-center gap-3 rounded-xl border-2 border-[#FF8C42] bg-orange-50 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF8C42] text-white">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Pay online</p>
            <p className="text-xs text-slate-500">UPI, cards, netbanking via Razorpay</p>
          </div>
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
