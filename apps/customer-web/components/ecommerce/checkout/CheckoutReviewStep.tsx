'use client';

import { useRef, useState } from 'react';
import { Loader2, MapPin, Package, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCheckout } from '@/context/CheckoutProvider';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';
import { CheckoutPriceBreakdown } from './CheckoutPriceBreakdown';
import {
  allocateLinePromotionDiscount,
  cartLineMrpTotal,
} from '@/lib/ecommerce/cart-product-helpers';
import { getShippingOptionLabel } from '@/lib/ecommerce/checkout-shipping-options';
import {
  EcommerceCheckoutTermsAcceptance,
  type EcommerceCheckoutTermsAcceptanceHandle,
} from './EcommerceCheckoutTermsAcceptance';
import { cn } from '@/components/ui/utils';

export function CheckoutReviewStep() {
  const nav = useCustomerNavigation();
  const termsRef = useRef<EcommerceCheckoutTermsAcceptanceHandle>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const {
    cart,
    pricing,
    address,
    shippingMethod,
    savingsAmount,
    promotionLabel,
    isPlacingOrder,
    placeOrder,
    setStep,
  } = useCheckout();

  const handlePayClick = () => {
    if (!termsAccepted) {
      termsRef.current?.triggerAttention();
      toast.error('Please accept the Terms & Conditions to continue');
      return;
    }
    void placeOrder();
  };

  const payBlocked = isPlacingOrder || !address || cart.length === 0;

  return (
    <div className="space-y-4">
      {savingsAmount > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-white text-sm">
          <p className="font-semibold">
            You&apos;re saving ₹{savingsAmount.toFixed(0)} with your promotion
          </p>
          {promotionLabel ? (
            <p className="text-xs text-white/90 mt-0.5">{promotionLabel}</p>
          ) : null}
        </div>
      )}

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#FF8C42]" />
            <h3 className="font-semibold text-slate-900">Deliver to</h3>
          </div>
          <button
            type="button"
            onClick={() => nav.goToCart()}
            className="text-sm font-medium text-[#FF8C42]"
          >
            Change
          </button>
        </div>
        {address ? (
          <p className="text-sm text-slate-600">
            {address.fullName || address.name}
            <br />
            {address.addressLine1 || address.street}, {address.city} {address.pincode}
          </p>
        ) : (
          <p className="text-sm text-slate-500">No address selected</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Truck className="h-4 w-4 text-[#FF8C42]" />
          <h3 className="font-semibold text-slate-900">Delivery</h3>
        </div>
        <p className="text-sm text-slate-600">{getShippingOptionLabel(shippingMethod)}</p>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[#FF8C42]" />
            <h3 className="font-semibold text-slate-900">Items ({cart.length})</h3>
          </div>
          <button
            type="button"
            onClick={() => setStep('payment')}
            className="text-sm font-medium text-[#FF8C42]"
          >
            Change payment
          </button>
        </div>
        <div className="space-y-2">
          {cart.map((item) => {
            const lineMrp = cartLineMrpTotal(item);
            const lineDiscount = allocateLinePromotionDiscount(
              lineMrp,
              pricing.lineSubtotal,
              pricing.discount,
            );
            const linePayable = Math.max(0, lineMrp - lineDiscount);
            const hasPromotion = pricing.discount > 0;

            return (
              <div key={item.id} className="flex justify-between text-sm gap-2">
                <span className="text-slate-600 line-clamp-1 flex-1">
                  {item.name} × {item.quantity}
                </span>
                <div className="shrink-0 text-right">
                  {hasPromotion ? (
                    <>
                      <div className="text-xs text-slate-400 tabular-nums">
                        <span className="cw-price-strike">₹{lineMrp.toFixed(0)}</span>
                      </div>
                      <span className="font-medium text-slate-900 tabular-nums">
                        ₹{linePayable.toFixed(0)}
                      </span>
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
        <p className="mt-2 text-xs text-slate-500">Payment: Online (Razorpay)</p>
      </section>

      <EcommerceCheckoutTermsAcceptance
        ref={termsRef}
        accepted={termsAccepted}
        onAcceptedChange={setTermsAccepted}
      />

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:hidden">
        <CheckoutPriceBreakdown
          cart={cart}
          pricing={pricing}
          showItems={false}
          promotionLabel={promotionLabel}
        />
      </section>

      <Button
        type="button"
        onClick={handlePayClick}
        disabled={payBlocked}
        className={cn(
          'w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A29] text-white font-semibold rounded-xl',
          !termsAccepted && !payBlocked && 'opacity-60',
        )}
      >
        {isPlacingOrder ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Placing order…
          </span>
        ) : (
          `Pay ₹${pricing.total.toFixed(0)}`
        )}
      </Button>
    </div>
  );
}

