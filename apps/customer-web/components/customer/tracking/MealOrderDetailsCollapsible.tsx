'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  buildMealOrderTrackingSummary,
  formatInr,
} from '@/lib/meal-order-tracking-details';

export function MealOrderDetailsCollapsible({ order }: { order: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const summary = buildMealOrderTrackingSummary(order);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center justify-between"
      >
        <span className="font-semibold text-gray-900">Order Details</span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="bg-white rounded-b-2xl shadow-sm px-4 pb-4 -mt-2 pt-2 border border-t-0 border-slate-100">
          <div className="mb-4 pb-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900">{summary.planTitle}</p>
            {summary.quantity > 1 ? (
              <p className="text-xs text-slate-500 mt-0.5">Quantity: {summary.quantity}</p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2 text-sm">
            <h3 className="font-semibold text-slate-900 mb-1">Order summary</h3>
            {summary.lines.map((line) => (
              <div key={line.label} className="flex justify-between gap-3">
                <span className="text-slate-600 shrink-0">
                  {line.label}
                  {line.sublabel ? (
                    <span className="text-slate-500"> ({line.sublabel})</span>
                  ) : null}
                </span>
                <span className="text-slate-900 font-medium tabular-nums">
                  {line.amount > 0 || line.showZero ? `₹${formatInr(line.amount)}` : '—'}
                </span>
              </div>
            ))}
            <div className="flex justify-between font-semibold border-t border-slate-200 pt-2 mt-1 text-slate-900">
              <span>Total</span>
              <span className="text-green-600 tabular-nums">₹{formatInr(summary.total)}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
