'use client';

import type { CartPricingBreakdown } from '@/lib/ecommerce/cart-pricing';
import type { CartItem } from '@/context/CartContext';
import { PriceBreakdown } from '@/components/customer/pricing/PriceBreakdown';
import { buildEcommerceCheckoutPriceLines } from '@/lib/pricing/ecommerce-checkout-price-breakdown';

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
  const lines = buildEcommerceCheckoutPriceLines(pricing);

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

      <PriceBreakdown lines={lines} title="" compact={compact} className="border-0 shadow-none" />
    </div>
  );
}
