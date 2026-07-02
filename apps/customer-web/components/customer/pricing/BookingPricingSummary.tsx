'use client';

import { PriceBreakdown } from './PriceBreakdown';
import { SavingsBadge } from './SavingsBadge';
import { formatInr } from '@/lib/pricing/format';
import type { BookingFinancialSnapshot } from '@/lib/pricing/booking-financial';

export type BookingPricingSummaryProps = {
  financial: BookingFinancialSnapshot;
  title?: string;
  showSavingsBanner?: boolean;
  compact?: boolean;
  className?: string;
};

export function BookingPricingSummary({
  financial,
  title = 'Payment summary',
  showSavingsBanner = true,
  compact = false,
  className = '',
}: BookingPricingSummaryProps) {
  const { totalSavings, finalPaid, couponCode, promotionNames, lines } = financial;

  return (
    <div className={`space-y-3 ${className}`}>
      {showSavingsBanner && totalSavings > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 border border-emerald-100">
          <SavingsBadge variant="save_amount" amount={totalSavings} />
          {couponCode ? <SavingsBadge variant="coupon_applied" label={`Coupon: ${couponCode}`} /> : null}
          {promotionNames.map((name) => (
            <SavingsBadge
              key={name}
              variant={name.toLowerCase().includes('platform') ? 'platform_offer' : 'vendor_offer'}
              label={name}
            />
          ))}
          <span className="text-sm font-semibold text-emerald-800">
            You saved {formatInr(totalSavings)}
          </span>
        </div>
      )}
      <PriceBreakdown lines={lines} title={title} compact={compact} />
      {finalPaid > 0 && (
        <p className="text-center text-xs text-slate-500">
          Amount paid: <span className="font-semibold text-slate-800">{formatInr(finalPaid)}</span>
        </p>
      )}
    </div>
  );
}
