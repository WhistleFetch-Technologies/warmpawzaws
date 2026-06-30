'use client';

import { Check } from 'lucide-react';
import {
  buildMealOrderTrackingSummary,
  formatInr,
} from '@/lib/meal-order-tracking-details';
import { resolvePaymentMethodLabel } from '@/components/customer/tracking/meal-tracking-display';

export function MealPaymentSummaryCard({ order }: { order: Record<string, unknown> }) {
  const summary = buildMealOrderTrackingSummary(order);
  const paymentMethod = resolvePaymentMethodLabel(order);
  const ps = String(order.payment_status ?? order.paymentStatus ?? '').toLowerCase();
  const isPaid = ps === 'paid' || ps === 'completed';

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
      <h2 className="mb-3 text-base font-bold text-slate-900">Payment Summary</h2>
      <div className="space-y-2 text-sm">
        {summary.lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-3">
            <span className="text-slate-600">
              {line.label}
              {line.sublabel ? (
                <span className="text-slate-500"> ({line.sublabel})</span>
              ) : null}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-slate-900">
              {line.amount > 0 || line.showZero ? `₹${formatInr(line.amount)}` : '—'}
            </span>
          </div>
        ))}
        <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
          <span>Total Paid</span>
          <span className="tabular-nums text-emerald-700">₹{formatInr(summary.total)}</span>
        </div>
        {paymentMethod ? (
          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-600">{paymentMethod}</span>
            {isPaid ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                <Check className="h-3 w-3" aria-hidden />
                Paid
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
