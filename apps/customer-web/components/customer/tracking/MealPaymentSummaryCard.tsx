'use client';

import {
  buildMealOrderTrackingSummary,
} from '@/lib/meal-order-tracking-details';
import { mapMealSummaryToPriceLines } from '@/lib/pricing/meal-order-price-breakdown';
import { FinancialInvoiceSummary } from '@/components/customer/pricing/FinancialInvoiceSummary';
import { resolvePaymentMethodLabel } from '@/components/customer/tracking/meal-tracking-display';

export function MealPaymentSummaryCard({ order }: { order: Record<string, unknown> }) {
  const summary = buildMealOrderTrackingSummary(order);
  const paymentMethod = resolvePaymentMethodLabel(order);
  const ps = String(order.payment_status ?? order.paymentStatus ?? '').toLowerCase();
  const isPaid = ps === 'paid' || ps === 'completed';
  const lines = mapMealSummaryToPriceLines(summary.lines, summary.total);

  const discount = Number(order.discount_amount ?? order.discountAmount ?? 0) || 0;
  const couponCode = order.coupon_code ?? order.couponCode;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
      <FinancialInvoiceSummary
        lines={lines}
        title="Payment summary"
        totalSavings={discount > 0 ? discount : undefined}
        couponCode={couponCode ? String(couponCode) : undefined}
        paymentMethod={paymentMethod ?? undefined}
        paymentStatus={isPaid ? 'paid' : ps || undefined}
        compact
        showSavingsBanner={discount > 0}
      />
    </section>
  );
}
