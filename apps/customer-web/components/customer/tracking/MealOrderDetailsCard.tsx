'use client';

import { useState } from 'react';
import { Calendar, ChevronDown, Hash, UtensilsCrossed } from 'lucide-react';
import { buildMealOrderTrackingSummary, formatInr } from '@/lib/meal-order-tracking-details';
import { formatMealOrderDisplayId } from '@/components/customer/tracking/MealPlanOrderTrackingUI';

export function MealOrderDetailsCard({ order }: { order: Record<string, unknown> }) {
  const [open, setOpen] = useState(true);
  const summary = buildMealOrderTrackingSummary(order);
  const orderId = formatMealOrderDisplayId(order);
  const created = order.created_at ?? order.createdAt;
  const createdLabel =
    created != null
      ? new Date(String(created)).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '—';

  const mealLine = summary.lines.find((l) => l.label.toLowerCase().includes('meal'));
  const mealPrice = mealLine?.amount ?? summary.total;

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-bold text-slate-900">Order Details</span>
        <ChevronDown
          className={`h-5 w-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
          <div className="flex gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
              <UtensilsCrossed className="h-6 w-6 text-orange-500" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{summary.planTitle}</p>
              <p className="mt-0.5 text-sm text-slate-500">Qty: {summary.quantity}</p>
              <p className="mt-1 text-sm font-bold tabular-nums text-orange-600">
                ₹{formatInr(mealPrice)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <span>{orderId}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <span>{createdLabel}</span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
