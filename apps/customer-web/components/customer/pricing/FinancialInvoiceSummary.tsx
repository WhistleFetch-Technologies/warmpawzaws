'use client';

import { PriceBreakdown } from './PriceBreakdown';
import { SavingsBadge } from './SavingsBadge';
import { formatInr } from '@/lib/pricing/format';
import type { PriceBreakdownLine } from '@/lib/pricing/types';

export type FinancialInvoiceSummaryProps = {
  lines: PriceBreakdownLine[];
  title?: string;
  totalSavings?: number;
  couponCode?: string;
  promotionLabels?: string[];
  paymentMethod?: string;
  paymentStatus?: 'paid' | 'pending' | 'failed' | string;
  compact?: boolean;
  showSavingsBanner?: boolean;
  className?: string;
};

export function FinancialInvoiceSummary({
  lines,
  title = 'Payment summary',
  totalSavings = 0,
  couponCode,
  promotionLabels = [],
  paymentMethod,
  paymentStatus,
  compact = false,
  showSavingsBanner = true,
  className = '',
}: FinancialInvoiceSummaryProps) {
  const visibleLines = lines.filter((line) => {
    if (line.kind === 'final') return true;
    return line.amount !== 0;
  });

  return (
    <div className={`space-y-3 ${className}`}>
      {showSavingsBanner && totalSavings > 0 && (
        <div
          className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3"
          role="status"
          aria-live="polite"
        >
          <p className="text-base font-bold text-emerald-800">
            🎉 You saved {formatInr(totalSavings)}!
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <SavingsBadge variant="save_amount" amount={totalSavings} />
            {couponCode ? (
              <SavingsBadge variant="coupon_applied" label={`Coupon: ${couponCode}`} />
            ) : null}
            {promotionLabels.map((name) => (
              <SavingsBadge
                key={name}
                variant={
                  name.toLowerCase().includes('platform') ? 'platform_offer' : 'vendor_offer'
                }
                label={name}
              />
            ))}
          </div>
        </div>
      )}
      <PriceBreakdown lines={visibleLines} title={title} compact={compact} />
      {(paymentMethod || paymentStatus) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
          {paymentMethod ? (
            <span>
              Payment: <span className="font-medium text-slate-700">{paymentMethod}</span>
            </span>
          ) : null}
          {paymentStatus ? (
            <span
              className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide ${
                paymentStatus === 'paid' || paymentStatus === 'completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {paymentStatus}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
