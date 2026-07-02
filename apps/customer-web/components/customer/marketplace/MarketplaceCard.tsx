'use client';

import type { ReactNode } from 'react';
import { Star } from 'lucide-react';
import { PriceDisplay } from '@/components/customer/pricing/PriceDisplay';
import { PromotionOfferBadge } from '@/components/customer/pricing/PromotionOfferBadge';
import { SavingsBadge } from '@/components/customer/pricing/SavingsBadge';
import type { MarketplaceCardData } from '@/lib/marketplace/types';
import { DOMAIN_LABELS, MARKETPLACE_CARD_CLASS } from '@/lib/marketplace/types';

function Thumbnail({
  imageUrl,
  fallback,
  alt,
}: {
  imageUrl?: string;
  fallback?: string;
  alt: string;
}) {
  if (imageUrl) {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }
  return (
    <div className="relative flex aspect-square w-full items-center justify-center rounded-xl bg-orange-50 text-3xl">
      {fallback ?? '🐾'}
    </div>
  );
}

export type MarketplaceCardProps = MarketplaceCardData & {
  layout?: 'vertical' | 'horizontal';
  onClick?: () => void;
  cta?: ReactNode;
  /** Replaces built-in price block (e.g. async service quotes) */
  priceSlot?: ReactNode;
  /** Absolute overlay on thumbnail (wishlist, cart controls) */
  imageOverlay?: ReactNode;
  className?: string;
};

export function MarketplaceCard({
  layout = 'vertical',
  onClick,
  cta,
  priceSlot,
  imageOverlay,
  className = '',
  ...data
}: MarketplaceCardProps) {
  const hasSavings =
    data.savingsAmount != null && data.savingsAmount > 0 && data.originalPrice != null;
  const discountPct =
    data.originalPrice && data.originalPrice > data.currentPrice
      ? Math.round(((data.originalPrice - data.currentPrice) / data.originalPrice) * 100)
      : undefined;

  const availabilityClass =
    data.availability === 'unavailable'
      ? 'text-red-600'
      : data.availability === 'limited'
        ? 'text-amber-700'
        : 'text-emerald-700';

  const inner = (
    <>
      <div className={`relative ${layout === 'horizontal' ? 'w-20 shrink-0' : 'w-full'}`}>
        <Thumbnail imageUrl={data.imageUrl} fallback={data.imageFallback} alt={data.title} />
        {imageOverlay}
        {(data.promotionLabel || discountPct) && (
          <div className="absolute top-2 left-2 z-[1] flex flex-wrap gap-1">
            {discountPct ? <PromotionOfferBadge variant="percent" value={discountPct} size="sm" /> : null}
            {data.promotionLabel ? (
              <SavingsBadge variant="auto_applied" label={data.promotionLabel} />
            ) : null}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-600">
              {DOMAIN_LABELS[data.domain]}
            </span>
            <h3 className="font-semibold text-slate-900 line-clamp-2 text-sm leading-snug">
              {data.title}
            </h3>
            {data.vendorName ? (
              <p className="text-xs text-slate-500 truncate mt-0.5">{data.vendorName}</p>
            ) : null}
          </div>
          {data.rating != null && data.rating > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              {data.rating.toFixed(1)}
            </span>
          ) : null}
        </div>

        {data.subtitle ? <p className="text-xs text-slate-500 line-clamp-2">{data.subtitle}</p> : null}

        <div className="mt-1">
          {priceSlot ??
            (hasSavings || (data.originalPrice && data.originalPrice > data.currentPrice) ? (
              <PriceDisplay
                originalPrice={data.originalPrice ?? data.currentPrice}
                currentPrice={data.currentPrice}
                size="sm"
                showSavings={Boolean(hasSavings)}
              />
            ) : (
              <p className="text-sm font-bold text-orange-600 tabular-nums">
                ₹{data.currentPrice.toLocaleString('en-IN')}
              </p>
            ))}
        </div>

        {data.availabilityLabel ? (
          <p className={`text-[10px] font-medium ${availabilityClass}`}>{data.availabilityLabel}</p>
        ) : null}

        {data.meta?.length ? (
          <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
            {data.meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        ) : null}

        {cta ? <div className="mt-2" onClick={(e) => e.stopPropagation()}>{cta}</div> : null}
      </div>
    </>
  );

  const shellClass = `${MARKETPLACE_CARD_CLASS} overflow-hidden p-3 ${className} ${
    onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
  }`;

  if (layout === 'horizontal') {
    return (
      <article className={`relative flex gap-3 ${shellClass}`} onClick={onClick} role={onClick ? 'button' : undefined}>
        {inner}
      </article>
    );
  }

  return (
    <article className={`relative flex flex-col gap-2 ${shellClass}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      {inner}
    </article>
  );
}
