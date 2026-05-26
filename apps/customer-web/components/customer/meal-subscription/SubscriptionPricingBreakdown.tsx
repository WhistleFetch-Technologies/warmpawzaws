'use client';

/**
 * Mirrors one-time meal checkout (`MealOrderCheckout` order summary):
 * meal price, delivery, platform fee, convenience fee, total — with subscription context (cycles, sessions).
 */

export function SubscriptionPricingBreakdown({
  purchaseTypeLabel,
  billingCycleLabel,
  mealsPerDelivery,
  subtotalPerCycle,
  billingCycles,
  deliveriesPerBillingCycle,
  totalSessions,
  foodSubtotalUpfront,
  deliveryFee,
  deliveryFeePendingAddress,
  platformFeePerCycle,
  platformFeeUpfront,
  convenienceFeePerCycle,
  convenienceFeeUpfront,
  upfrontTotal,
  gstPreview,
}: {
  purchaseTypeLabel: string;
  billingCycleLabel: string;
  mealsPerDelivery: number;
  /** One billing cycle food subtotal (bundle), same basis as one-time "meal price". */
  subtotalPerCycle: number;
  billingCycles: number;
  deliveriesPerBillingCycle: number;
  totalSessions: number;
  /** Food component for full signup (cycles × per-cycle food). */
  foodSubtotalUpfront: number;
  deliveryFee: number | null;
  deliveryFeePendingAddress?: boolean;
  platformFeePerCycle: number;
  platformFeeUpfront: number;
  convenienceFeePerCycle: number;
  convenienceFeeUpfront: number;
  upfrontTotal: number;
  /** Same `gst` object as GET /meal-plans/:planId/order-preview (weekly/monthly). */
  gstPreview?: {
    foodGstPct?: number;
    deliveryGstPct?: number;
    foodGstAmount?: number;
    deliveryGstAmount?: number;
    totalGstAmount?: number;
  } | null;
}) {
  const fmt = (n: number) => `₹${Number.isFinite(n) ? n : 0}`;

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 space-y-3 text-sm">
      <h3 className="font-semibold text-slate-900">Order summary</h3>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Meal price</span>
          <span className="text-right">
            {fmt(foodSubtotalUpfront)}
            {billingCycles > 1 ? (
              <span className="block text-[11px] font-normal text-slate-500">
                {fmt(subtotalPerCycle)} per cycle × {billingCycles} cycles
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Delivery</span>
          <span>
            {deliveryFeePendingAddress || deliveryFee == null ? 'Select address' : fmt(deliveryFee)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Platform fee</span>
          <span className="text-right">
            {fmt(platformFeeUpfront)}
            {billingCycles > 1 ? (
              <span className="block text-[11px] font-normal text-slate-500">
                {fmt(platformFeePerCycle)} per cycle × {billingCycles} cycles
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Convenience fee</span>
          <span className="text-right">
            {fmt(convenienceFeeUpfront)}
            {billingCycles > 1 ? (
              <span className="block text-[11px] font-normal text-slate-500">
                {fmt(convenienceFeePerCycle)} per cycle × {billingCycles} cycles
              </span>
            ) : null}
          </span>
        </div>
        {gstPreview != null && Number(gstPreview.totalGstAmount) > 0.009 ? (
          <>
            {(gstPreview.foodGstAmount ?? 0) > 0.009 ? (
              <div className="flex justify-between text-slate-700">
                <span>
                  GST (meal)
                  {gstPreview.foodGstPct != null && Number.isFinite(gstPreview.foodGstPct)
                    ? ` (${gstPreview.foodGstPct}%)`
                    : ''}
                </span>
                <span>{fmt(Number(gstPreview.foodGstAmount ?? 0))}</span>
              </div>
            ) : null}
            {(gstPreview.deliveryGstAmount ?? 0) > 0.009 ? (
              <div className="flex justify-between text-slate-700">
                <span>
                  GST (delivery)
                  {gstPreview.deliveryGstPct != null && Number.isFinite(gstPreview.deliveryGstPct)
                    ? ` (${gstPreview.deliveryGstPct}%)`
                    : ''}
                </span>
                <span>{fmt(Number(gstPreview.deliveryGstAmount ?? 0))}</span>
              </div>
            ) : null}
            {(gstPreview.foodGstAmount ?? 0) <= 0.009 && (gstPreview.deliveryGstAmount ?? 0) <= 0.009 ? (
              <div className="flex justify-between text-slate-700">
                <span>GST</span>
                <span>{fmt(Number(gstPreview.totalGstAmount ?? 0))}</span>
              </div>
            ) : null}
          </>
        ) : null}
        <div className="flex justify-between font-semibold text-slate-900 pt-2 border-t border-slate-100">
          <span>Total</span>
          <span>{fmt(upfrontTotal)}</span>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
        <div className="flex justify-between">
          <span>Type</span>
          <span className="font-medium text-slate-900">{purchaseTypeLabel}</span>
        </div>
        <div className="flex justify-between">
          <span>Billing rhythm</span>
          <span className="font-medium text-slate-900">{billingCycleLabel}</span>
        </div>
        <div className="flex justify-between">
          <span>Meals per delivery</span>
          <span className="font-medium text-slate-900">{mealsPerDelivery}</span>
        </div>
        <div className="flex justify-between">
          <span>Deliveries per cycle</span>
          <span className="font-medium text-slate-900">{deliveriesPerBillingCycle}</span>
        </div>
        <div className="flex justify-between">
          <span>Billing cycles (this signup)</span>
          <span className="font-medium text-slate-900">{billingCycles}</span>
        </div>
        <div className="flex justify-between">
          <span>Total delivery sessions</span>
          <span className="font-medium text-slate-900">{totalSessions}</span>
        </div>
      </div>

      <p className="text-xs text-slate-500 leading-snug">
        Delivery is estimated for all sessions in this signup (same rules as one-time meal orders). Platform and
        convenience fees apply per billing cycle. GST on meal and delivery matches Admin Finance (meal_plan_food /
        meal_plan_delivery), same as buy-once checkout.
      </p>
    </div>
  );
}
