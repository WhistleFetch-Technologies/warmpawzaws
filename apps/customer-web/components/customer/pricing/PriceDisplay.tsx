'use client';

import { hasEffectivePriceReduction } from '@warmpawz/shared-types';
import { computeDiscountPercent, formatInr } from '@/lib/pricing/format';
import type { PricingDomain } from '@/lib/pricing/types';
import { PromotionOfferBadge } from './PromotionOfferBadge';

export type PriceDisplayProps = {
  originalPrice: number;
  currentPrice: number;
  domain?: PricingDomain;
  size?: 'sm' | 'md' | 'lg';
  showSavings?: boolean;
  showDiscountPercent?: boolean;
  /** When set, overrides percent derived from original vs current price (e.g. stated promo %). */
  discountPercent?: number;
  prefix?: string;
  suffix?: string;
  loading?: boolean;
  offerAvailable?: boolean;
  /** Right-align price row (listing cards with price on the trailing edge). */
  align?: 'start' | 'end';
  className?: string;
};

const sizeClasses = {
  sm: { current: 'text-sm font-semibold', original: 'text-xs', savings: 'text-[10px]' },
  md: { current: 'text-base font-bold', original: 'text-sm', savings: 'text-xs' },
  lg: { current: 'text-xl font-bold', original: 'text-base', savings: 'text-sm' },
};

export function PriceDisplay({
  originalPrice,
  currentPrice,
  size = 'md',
  showSavings = true,
  showDiscountPercent = true,
  discountPercent: discountPercentOverride,
  prefix,
  suffix,
  loading = false,
  offerAvailable = false,
  align = 'start',
  className = '',
}: PriceDisplayProps) {
  const styles = sizeClasses[size];
  const hasReduction = hasEffectivePriceReduction(originalPrice, currentPrice);
  const savings = hasReduction ? originalPrice - currentPrice : 0;
  const discountPercent =
    discountPercentOverride ?? computeDiscountPercent(originalPrice, currentPrice);
  const alignEnd = align === 'end';
  const colAlign = alignEnd ? 'items-end text-right' : '';
  const rowAlign = alignEnd ? 'justify-end' : '';

  if (loading) {
    return (
      <div className={`flex flex-col gap-1 ${colAlign} ${className}`}>
        <div className="h-5 w-20 animate-pulse rounded bg-slate-200" />
      </div>
    );
  }

  if (offerAvailable && !hasReduction) {
    return (
      <div className={`flex flex-col gap-1 ${colAlign} ${className}`}>
        <span className={`text-[#FF8C42] ${styles.current}`}>Offer available</span>
        <span className={`text-slate-500 ${styles.original}`}>From {formatInr(originalPrice)}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${colAlign} ${className}`} aria-label="Price">
      <div className={`flex flex-wrap items-center gap-2 ${rowAlign}`}>
        {hasReduction && (
          <span className={`text-slate-400 cw-price-strike ${styles.original}`}>
            {formatInr(originalPrice)}
          </span>
        )}
        <span className={`text-[#FF8C42] ${styles.current}`}>
          {prefix}
          {formatInr(hasReduction ? currentPrice : originalPrice)}
          {suffix}
        </span>
        {showDiscountPercent && discountPercent != null && discountPercent > 0 && (
          <PromotionOfferBadge variant="percent" value={discountPercent} size={size === 'lg' ? 'md' : 'sm'} />
        )}
      </div>
      {showSavings && savings > 0 && (
        <span className={`text-emerald-600 font-medium ${styles.savings}`}>
          You save {formatInr(savings)}
        </span>
      )}
    </div>
  );
}
