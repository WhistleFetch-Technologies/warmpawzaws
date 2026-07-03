'use client';

import { PriceBreakdown } from './PriceBreakdown';
import { FinancialInvoiceSummary } from './FinancialInvoiceSummary';
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
  const { totalSavings, couponCode, promotionNames, lines } = financial;

  return (
    <FinancialInvoiceSummary
      lines={lines}
      title={title}
      totalSavings={totalSavings}
      couponCode={couponCode}
      promotionLabels={promotionNames}
      compact={compact}
      showSavingsBanner={showSavingsBanner}
      className={className}
    />
  );
}

/** Re-export for screens that only need the breakdown table. */
export { PriceBreakdown };
