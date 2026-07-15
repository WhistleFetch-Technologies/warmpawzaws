'use client';

import type { CartPricingBreakdown } from '@/lib/ecommerce/cart-pricing';
import type { CartItem } from '@/context/CartContext';
import { PriceBreakdown } from '@/components/customer/pricing/PriceBreakdown';
import {
  allocateLinePromotionDiscount,
  cartLineMrpTotal,
} from '@/lib/ecommerce/cart-product-helpers';
import { buildEcommerceCheckoutPriceLines } from '@/lib/pricing/ecommerce-checkout-price-breakdown';

type CheckoutPriceBreakdownProps = {
  cart: CartItem[];
  pricing: CartPricingBreakdown;
  compact?: boolean;
  showItems?: boolean;
  promotionLabel?: string;
};

export function CheckoutPriceBreakdown({
  cart,
  pricing,
  compact = false,
  showItems = true,
  promotionLabel,
}: CheckoutPriceBreakdownProps) {
  const lines = buildEcommerceCheckoutPriceLines(pricing, { promotionLabel });
  const hasPromotion = pricing.discount > 0;

  return (
    <div className="space-y-3">
      {showItems && !compact && (
        <div className="space-y-2 border-b border-slate-100 pb-3">
          {cart.map((item) => {
            const lineMrp = cartLineMrpTotal(item);
            const lineDiscount = allocateLinePromotionDiscount(
              lineMrp,
              pricing.lineSubtotal,
              pricing.discount,
            );
            const linePayable = Math.max(0, lineMrp - lineDiscount);
            const unitMrp = item.originalPrice ?? item.price;

            return (
              <div key={item.id} className="flex justify-between gap-3 text-sm">
                <span className="text-slate-600 line-clamp-2 flex-1">
                  {item.name}
                  <span className="text-slate-400"> × {item.quantity}</span>
                </span>
                <div className="shrink-0 text-right">
                  {hasPromotion ? (
                    <>
                      <div className="text-xs text-slate-400 tabular-nums">
                        <span className="cw-price-strike">₹{lineMrp.toFixed(0)}</span>
                      </div>
                      <div className="font-medium text-slate-900 tabular-nums">
                        ₹{linePayable.toFixed(0)}
                      </div>
                      <div className="text-[10px] text-slate-400 tabular-nums">
                        ₹{unitMrp}/unit MRP
                      </div>
                    </>
                  ) : (
                    <span className="font-medium text-slate-900 tabular-nums">
                      ₹{lineMrp.toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PriceBreakdown lines={lines} title="" compact={compact} className="border-0 shadow-none" />
    </div>
  );
}
