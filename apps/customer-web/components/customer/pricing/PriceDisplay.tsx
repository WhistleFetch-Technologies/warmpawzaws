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
  prefix?: string;
  suffix?: string;
  loading?: boolean;
  offerAvailable?: boolean;
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
  prefix,
  suffix,
  loading = false,
  offerAvailable = false,
  className = '',
}: PriceDisplayProps) {
  const styles = sizeClasses[size];
  const hasReduction = hasEffectivePriceReduction(originalPrice, currentPrice);
  const savings = hasReduction ? originalPrice - currentPrice : 0;
  const discountPercent = computeDiscountPercent(originalPrice, currentPrice);

  if (loading) {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <div className="h-5 w-20 animate-pulse rounded bg-slate-200" />
      </div>
    );
  }

  if (offerAvailable && !hasReduction) {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <span className={`text-[#FF8C42] ${styles.current}`}>Offer available</span>
        <span className={`text-slate-500 ${styles.original}`}>From {formatInr(originalPrice)}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {hasReduction && (
          <span className={`text-slate-400 line-through ${styles.original}`}>
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
