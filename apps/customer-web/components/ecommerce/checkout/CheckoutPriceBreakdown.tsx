'use client';

import type { CartPricingBreakdown } from '@/lib/ecommerce/cart-pricing';
import type { CartItem } from '@/context/CartContext';

type CheckoutPriceBreakdownProps = {
  cart: CartItem[];
  pricing: CartPricingBreakdown;
  compact?: boolean;
  showItems?: boolean;
};

export function CheckoutPriceBreakdown({
  cart,
  pricing,
  compact = false,
  showItems = true,
}: CheckoutPriceBreakdownProps) {
  return (
    <div className="space-y-3">
      {showItems && !compact && (
        <div className="space-y-2 border-b border-slate-100 pb-3">
          {cart.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 text-sm">
              <span className="text-slate-600 line-clamp-2 flex-1">
                {item.name}
                <span className="text-slate-400"> × {item.quantity}</span>
              </span>
              <span className="font-medium text-slate-900 shrink-0">
                ₹{(item.price * item.quantity).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">Subtotal</span>
          <span className="text-slate-900">₹{pricing.lineSubtotal.toFixed(0)}</span>
        </div>
        {(pricing.couponDiscount ?? 0) > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Coupon discount</span>
            <span>-₹{(pricing.couponDiscount ?? 0).toFixed(0)}</span>
          </div>
        )}
        {(pricing.sellerPromotionDiscount ?? 0) > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Store offer</span>
            <span>-₹{(pricing.sellerPromotionDiscount ?? 0).toFixed(0)}</span>
          </div>
        )}
        {pricing.deliveryFees > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Delivery</span>
            <span className="text-slate-900">₹{pricing.deliveryFees.toFixed(0)}</span>
          </div>
        )}
        {pricing.taxAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-600">Tax</span>
            <span className="text-slate-900">₹{pricing.taxAmount.toFixed(0)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold">
          <span className="text-slate-900">Total</span>
          <span className="text-[#FF8C42]">₹{pricing.total.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}
