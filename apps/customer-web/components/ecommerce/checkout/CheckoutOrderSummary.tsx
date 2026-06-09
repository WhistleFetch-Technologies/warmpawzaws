'use client';

import { useCheckout } from '@/context/CheckoutProvider';
import { CheckoutPriceBreakdown } from './CheckoutPriceBreakdown';

type CheckoutOrderSummaryProps = {
  sticky?: boolean;
};

export function CheckoutOrderSummary({ sticky = true }: CheckoutOrderSummaryProps) {
  const { cart, pricing, savingsAmount } = useCheckout();

  return (
    <aside
      className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ${
        sticky ? 'lg:sticky lg:top-24' : ''
      }`}
    >
      <h2 className="text-base font-bold text-slate-900 mb-4">Order summary</h2>
      {savingsAmount > 0 && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          You save ₹{savingsAmount.toFixed(0)} on this order
        </div>
      )}
      <CheckoutPriceBreakdown cart={cart} pricing={pricing} compact={false} showItems />
    </aside>
  );
}
