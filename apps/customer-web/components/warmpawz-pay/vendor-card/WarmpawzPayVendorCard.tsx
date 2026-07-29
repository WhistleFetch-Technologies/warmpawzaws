'use client';

import { memo } from 'react';
import { ChevronRight, Clock, MapPin, Shield, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/utils';
import { DiscoveryProviderAvatar } from '@/components/customer/shared/DiscoveryProviderAvatar';
import { PremiumVendorCardCtaSection } from './PremiumVendorCardCta';
import type {
  WarmpawzPayVendorCardBadge,
  WarmpawzPayVendorCardMetaItem,
  WarmpawzPayVendorCardProps,
} from './types';

const META_TONE_CLASS: Record<NonNullable<WarmpawzPayVendorCardMetaItem['tone']>, string> = {
  default: 'text-gray-600',
  muted: 'text-gray-500',
  accent: 'font-medium text-blue-600',
  success: 'text-green-700',
};

const BADGE_TONE_CLASS: Record<NonNullable<WarmpawzPayVendorCardBadge['tone']>, string> = {
  brand: 'border-orange-200 bg-orange-50 text-orange-700',
  discount: 'border-green-200 bg-green-50 text-green-700',
  neutral: 'border-gray-200 bg-gray-50 text-gray-700',
  success: 'border-green-200 bg-green-50 text-green-800',
};

function normalizeCopy(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Show availability in body OR footer — never both when copy matches. */
function resolveAvailabilityDisplay(
  availabilityText?: string,
  footerHint?: string,
): { bodyAvailability?: string; footerHint?: string } {
  const availability = normalizeCopy(availabilityText);
  const footer = normalizeCopy(footerHint);

  if (availability) {
    return {
      bodyAvailability: availability,
      footerHint: footer && footer !== availability ? footer : undefined,
    };
  }

  return {
    bodyAvailability: undefined,
    footerHint: footer || undefined,
  };
}

function shouldSkipMetaItem(
  item: WarmpawzPayVendorCardMetaItem,
  ctx: {
    address?: string;
    city?: string;
    distanceText?: string | null;
    bodyAvailability?: string;
    priceLabel?: string;
  },
): boolean {
  const label = normalizeCopy(item.label);
  if (!label) return true;
  if (item.id === 'distance' && normalizeCopy(ctx.distanceText)) return true;
  if (item.id === 'availability' && ctx.bodyAvailability) return true;
  if (item.id === 'city' && normalizeCopy(ctx.city)) return true;
  if (normalizeCopy(ctx.address) && label === normalizeCopy(ctx.address)) return true;
  if (normalizeCopy(ctx.distanceText) && label === normalizeCopy(ctx.distanceText)) return true;
  if (ctx.bodyAvailability && label === ctx.bodyAvailability) return true;
  if (normalizeCopy(ctx.priceLabel) && label === normalizeCopy(ctx.priceLabel)) return true;
  return false;
}

function PremiumWarmpawzPayVendorCard({
  name,
  imageUrl,
  subtitle,
  categoryLabel,
  rating,
  address,
  city,
  distanceText,
  availabilityText,
  experienceText,
  priceLabel,
  metaItems,
  badges,
  primaryAction,
  secondaryAction,
  footerHint,
  showVerified,
  verifiedAriaLabel,
  profileAriaLabel,
  onProfileClick,
  className,
}: WarmpawzPayVendorCardProps) {
  const categoryText = normalizeCopy(categoryLabel) || normalizeCopy(subtitle);
  const { bodyAvailability, footerHint: resolvedFooterHint } = resolveAvailabilityDisplay(
    availabilityText,
    footerHint,
  );
  const visibleMetaItems = metaItems?.filter(
    (item) =>
      !shouldSkipMetaItem(item, {
        address,
        city,
        distanceText,
        bodyAvailability,
        priceLabel,
      }),
  );
  const showPrice = Boolean(normalizeCopy(priceLabel));
  const showRating = Boolean(rating && rating.reviewCount > 0 && rating.average > 0);
  const hasCtaSection = Boolean(resolvedFooterHint || primaryAction || secondaryAction);

  return (
    <Card
      className={cn(
        'gap-0 overflow-hidden border-gray-100 bg-white shadow-sm',
        className,
      )}
    >
      <div className="p-4">
        <div className="flex min-w-0 items-start gap-4">
          <DiscoveryProviderAvatar
            name={name}
            photo={imageUrl ?? undefined}
            className="h-28 w-28 shrink-0 rounded-2xl border border-orange-100 object-cover shadow-sm"
            fallbackClassName="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-gradient-to-br from-[#FFF5EE] to-[#FFE8D6] text-2xl font-bold text-[#FF8C42]"
          />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-bold leading-tight text-gray-900">{name}</h3>
                  {showVerified ? (
                    <span className="inline-flex shrink-0 items-center">
                      <Shield className="h-4 w-4 text-green-500" aria-hidden />
                      {verifiedAriaLabel ? (
                        <span className="sr-only">{verifiedAriaLabel}</span>
                      ) : null}
                    </span>
                  ) : null}
                </div>

                {categoryText ? (
                  <p className="mt-0.5 truncate text-sm text-gray-500">{categoryText}</p>
                ) : null}

                {badges && badges.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {badges.map((badge, index) => (
                      <Badge
                        key={`${badge.label}-${index}`}
                        variant="outline"
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          BADGE_TONE_CLASS[badge.tone ?? 'neutral'],
                        )}
                      >
                        {badge.label}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              {onProfileClick && profileAriaLabel ? (
                <button
                  type="button"
                  aria-label={profileAriaLabel}
                  className="-m-1.5 shrink-0 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-orange-50 hover:text-[#FF8C42] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#FF8C42] focus-visible:ring-offset-2"
                  onClick={onProfileClick}
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              ) : null}
            </div>

            {(showRating || normalizeCopy(distanceText) || showPrice || normalizeCopy(city)) ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                {showRating ? (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                    <span className="text-sm font-semibold text-gray-900">{rating?.average}</span>
                    <span className="text-sm text-gray-500">({rating?.reviewCount})</span>
                  </div>
                ) : null}

                {normalizeCopy(distanceText) ? (
                  <span className="text-sm font-medium text-blue-600">{distanceText}</span>
                ) : null}

                {normalizeCopy(city) ? (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{city}</span>
                  </div>
                ) : null}

                {showPrice ? (
                  <span className="text-sm font-semibold text-gray-900">{priceLabel}</span>
                ) : null}
              </div>
            ) : null}

            {normalizeCopy(address) ? (
              <div className="mt-2 flex min-w-0 items-start gap-1.5 text-sm text-gray-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                <span className="line-clamp-2">{address}</span>
              </div>
            ) : null}

            {bodyAvailability ? (
              <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-green-700">
                <Clock className="h-4 w-4 shrink-0" aria-hidden />
                <span>{bodyAvailability}</span>
              </div>
            ) : null}

            {normalizeCopy(experienceText) ? (
              <p className="mt-1.5 text-sm text-gray-500">{experienceText}</p>
            ) : null}

            {visibleMetaItems && visibleMetaItems.length > 0 ? (
              <div className="mt-2 space-y-1">
                {visibleMetaItems.map((item) => {
                  const Icon = item.icon;
                  const toneClass = META_TONE_CLASS[item.tone ?? 'default'];

                  return (
                    <div
                      key={item.id}
                      className={cn('flex min-w-0 items-center gap-1.5 text-sm', toneClass)}
                    >
                      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                      <span className="line-clamp-2">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {hasCtaSection ? (
        <PremiumVendorCardCtaSection
          footerHint={resolvedFooterHint}
          primaryAction={primaryAction}
          secondaryAction={secondaryAction}
        />
      ) : null}
    </Card>
  );
}

function WarmpawzPayVendorCardComponent(props: WarmpawzPayVendorCardProps) {
  return <PremiumWarmpawzPayVendorCard {...props} />;
}

export const WarmpawzPayVendorCard = memo(WarmpawzPayVendorCardComponent);
WarmpawzPayVendorCard.displayName = 'WarmpawzPayVendorCard';

export type {
  WarmpawzPayVendorCardAction,
  WarmpawzPayVendorCardBadge,
  WarmpawzPayVendorCardMetaItem,
  WarmpawzPayVendorCardMetaTone,
  WarmpawzPayVendorCardProps,
  WarmpawzPayVendorCardRating,
  WarmpawzPayVendorCardVariant,
} from './types';
