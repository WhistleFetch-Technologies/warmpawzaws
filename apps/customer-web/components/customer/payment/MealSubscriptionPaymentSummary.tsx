'use client';

import { UtensilsCrossed } from 'lucide-react';
import { Card } from '@/components/ui/card';

export type MealSubscriptionSummaryLine = {
  label: string;
  amountInr?: number;
  muted?: boolean;
  /** When set, shown instead of amount (e.g. date text). */
  valueText?: string;
};

type MealSubscriptionPaymentSummaryProps = {
  planTitle: string;
  vendorName: string;
  lines: MealSubscriptionSummaryLine[];
  /** Grand total customer pays for this signup (matches Razorpay + wallet). */
  totalInr: number;
};

/**
 * Payment-step summary for recurring meal plans (distinct from service booking GST layout).
 */
export function MealSubscriptionPaymentSummary({
  planTitle,
  vendorName,
  lines,
  totalInr,
}: MealSubscriptionPaymentSummaryProps) {
  return (
    <Card className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-gray-900">Meal subscription</h2>
      <div className="flex items-start gap-4 border-b border-gray-100 pb-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
          <UtensilsCrossed className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900">{planTitle}</h3>
          <p className="text-sm text-gray-500">{vendorName}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {lines.map((row, idx) => (
          <div
            key={`${idx}-${row.label}`}
            className={`flex justify-between text-sm ${row.muted ? 'text-gray-500' : 'text-gray-800'}`}
          >
            <span>{row.label}</span>
            <span className="font-medium">
              {row.valueText != null
                ? row.valueText
                : row.amountInr != null
                  ? `₹${row.amountInr.toFixed(2)}`
                  : '—'}
            </span>
          </div>
        ))}
        <div className="flex justify-between border-t border-gray-100 pt-3 text-base font-bold text-gray-900">
          <span>Total due</span>
          <span className="text-[#FF8C42]">₹{totalInr.toFixed(2)}</span>
        </div>
      </div>
    </Card>
  );
}
