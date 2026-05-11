'use client';

export function SubscriptionPricingBreakdown({
  purchaseTypeLabel,
  billingCycleLabel,
  perDeliveryTotal,
  sessions,
  mealsPerDelivery,
}: {
  purchaseTypeLabel: string;
  billingCycleLabel: string;
  perDeliveryTotal: number;
  sessions: number;
  mealsPerDelivery: number;
}) {
  const estimated = Math.round(perDeliveryTotal * sessions * 100) / 100;
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 space-y-2 text-sm">
      <h3 className="font-semibold text-slate-900">Subscription pricing</h3>
      <div className="flex justify-between text-slate-600">
        <span>Type</span>
        <span className="font-medium text-slate-900">{purchaseTypeLabel}</span>
      </div>
      <div className="flex justify-between text-slate-600">
        <span>Billing rhythm</span>
        <span className="font-medium text-slate-900">{billingCycleLabel}</span>
      </div>
      <div className="flex justify-between text-slate-600">
        <span>Meals per delivery</span>
        <span className="font-medium text-slate-900">{mealsPerDelivery}</span>
      </div>
      <div className="flex justify-between text-slate-600">
        <span>Est. per delivery (incl. fees)</span>
        <span className="font-medium text-slate-900">₹{perDeliveryTotal}</span>
      </div>
      <div className="flex justify-between text-slate-600">
        <span>Total sessions (this signup)</span>
        <span className="font-medium text-slate-900">{sessions}</span>
      </div>
      <div className="flex justify-between pt-2 border-t border-slate-100 font-semibold text-slate-900">
        <span>Estimated upfront total</span>
        <span>₹{estimated}</span>
      </div>
      <p className="text-xs text-slate-500">
        Razorpay will charge this estimate for your initial subscription payment. Renewals may differ slightly if fees
        change.
      </p>
    </div>
  );
}
