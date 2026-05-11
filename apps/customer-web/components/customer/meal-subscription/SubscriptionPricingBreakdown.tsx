'use client';

export function SubscriptionPricingBreakdown({
  purchaseTypeLabel,
  billingCycleLabel,
  mealsPerDelivery,
  packageTotalOneCycle,
  deliveriesPerBillingCycle,
  billingCycles,
  totalSessions,
  upfrontTotal,
}: {
  purchaseTypeLabel: string;
  billingCycleLabel: string;
  mealsPerDelivery: number;
  /** One billing cycle (e.g. one week / one month bundle) incl. fees — from order-preview. */
  packageTotalOneCycle: number;
  deliveriesPerBillingCycle: number;
  billingCycles: number;
  totalSessions: number;
  upfrontTotal: number;
}) {
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
        <span>One cycle total (incl. fees)</span>
        <span className="font-medium text-slate-900">₹{packageTotalOneCycle}</span>
      </div>
      <div className="flex justify-between text-slate-600">
        <span>Deliveries per cycle</span>
        <span className="font-medium text-slate-900">{deliveriesPerBillingCycle}</span>
      </div>
      <div className="flex justify-between text-slate-600">
        <span>Billing cycles (this signup)</span>
        <span className="font-medium text-slate-900">{billingCycles}</span>
      </div>
      <div className="flex justify-between text-slate-600">
        <span>Total delivery sessions</span>
        <span className="font-medium text-slate-900">{totalSessions}</span>
      </div>
      <div className="flex justify-between pt-2 border-t border-slate-100 font-semibold text-slate-900">
        <span>Estimated upfront total</span>
        <span>₹{upfrontTotal}</span>
      </div>
      <p className="text-xs text-slate-500">
        The catalog price is a weekly or monthly bundle (not per single meal). Upfront = one cycle total × billing
        cycles, where cycles are derived from your session count and vendor cadence. Razorpay charges this estimate now;
        renewals may differ if fees change.
      </p>
    </div>
  );
}
