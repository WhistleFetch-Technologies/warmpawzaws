'use client';

import { SavingsBadge } from './SavingsBadge';
import { PromotionOfferBadge } from './PromotionOfferBadge';
import { PriceDisplay } from './PriceDisplay';
import { formatInr } from '@/lib/pricing/format';
import type { AppliedPromotionOffer } from '@/lib/pricing/types';

export type PromotionCardProps = {
  offer: AppliedPromotionOffer;
  originalPrice?: number;
  currentPrice?: number;
  showPrice?: boolean;
  compact?: boolean;
  className?: string;
};

function badgeVariantForOffer(offer: AppliedPromotionOffer): 'percent' | 'flat' | 'bogo' | 'bundle' {
  const type = (offer.promotionType ?? '').toLowerCase();
  if (type.includes('bogo') || type.includes('buy_one')) return 'bogo';
  if (type.includes('bundle') || type.includes('combo')) return 'bundle';
  if (offer.discountType === 'percentage' || (offer.discountValue != null && offer.discountValue <= 100)) {
    return 'percent';
  }
  return 'flat';
}

function savingsVariant(offer: AppliedPromotionOffer) {
  if (offer.code) return 'coupon_applied' as const;
  if (offer.autoApply) return 'auto_applied' as const;
  if (offer.source === 'platform') return 'platform_offer' as const;
  if (offer.source === 'vendor') return 'vendor_offer' as const;
  return 'save_amount' as const;
}

export function PromotionCard({
  offer,
  originalPrice,
  currentPrice,
  showPrice = false,
  compact = false,
  className = '',
}: PromotionCardProps) {
  const badgeVariant = badgeVariantForOffer(offer);
  const badgeValue =
    badgeVariant === 'percent'
      ? offer.discountValue ?? undefined
      : badgeVariant === 'flat'
        ? offer.discountValue ?? offer.discountAmount
        : undefined;

  return (
    <div
      className={`rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50/80 to-white p-3 ${
        compact ? 'p-2.5' : 'p-3'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <PromotionOfferBadge variant={badgeVariant} value={badgeValue} size={compact ? 'sm' : 'md'} />
            <SavingsBadge
              variant={savingsVariant(offer)}
              amount={offer.discountAmount}
              label={
                offer.code
                  ? `Coupon: ${offer.code}`
                  : offer.autoApply
                    ? 'Auto applied'
                    : undefined
              }
            />
          </div>
          <p className={`font-semibold text-slate-900 ${compact ? 'text-sm' : 'text-base'}`}>
            {offer.name}
          </p>
          {offer.description ? (
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{offer.description}</p>
          ) : null}
          {offer.discountAmount != null && offer.discountAmount > 0 && !showPrice && (
            <p className="mt-1 text-xs font-medium text-emerald-600">
              Saves {formatInr(offer.discountAmount)}
            </p>
          )}
        </div>
      </div>
      {showPrice && originalPrice != null && currentPrice != null && (
        <div className="mt-2 border-t border-orange-100 pt-2">
          <PriceDisplay
            originalPrice={originalPrice}
            currentPrice={currentPrice}
            size={compact ? 'sm' : 'md'}
          />
        </div>
      )}
    </div>
  );
}
