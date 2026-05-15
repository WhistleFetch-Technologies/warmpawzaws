'use client';

import { Clock, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { FeaturedProvider } from '@/lib/featured-provider';
import { StarRating } from './StarRating';

export interface FeaturedProviderCardProps {
  provider: FeaturedProvider;
  onClick?: () => void;
  className?: string;
}

function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Featured Vets reference layout: orange avatar/photo, name, gray subtitle,
 * row with star + rating + (reviews) and clock + N+ years, optional distance,
 * orange price + gray unit.
 */
export function FeaturedProviderCard({
  provider,
  onClick,
  className = '',
}: FeaturedProviderCardProps) {
  const initial = provider.displayName?.charAt(0)?.toUpperCase() || 'P';

  const experienceYears = provider.experienceYears ?? 5;

  const showDistance =
    provider.distanceKm != null &&
    Number.isFinite(provider.distanceKm) &&
    provider.distanceKm >= 0;

  const cardClass =
    'p-4 cursor-pointer hover:shadow-md transition-all bg-white border border-gray-100 shadow-sm ' +
    className;

  const inner = (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#FF8C42] to-[#FF7029]">
        {provider.photoUrl ? (
          <img
            src={provider.photoUrl}
            alt={provider.displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl font-bold text-white">
            {initial}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="mb-1 truncate font-semibold text-gray-900">
          {provider.displayName}
        </h3>
        <p className="mb-2 line-clamp-2 text-xs text-gray-500">
          {provider.subtitle}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <StarRating
            rating={provider.rating}
            reviewCount={provider.reviewCount}
            starsClassName="h-3 w-3"
            textClassName="text-xs text-gray-500"
          />
          <div className="flex items-center gap-1 text-gray-500">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{experienceYears}+ years</span>
          </div>
          {showDistance ? (
            <div className="flex items-center gap-1 text-gray-500">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>{formatDistance(provider.distanceKm!)}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-lg font-bold text-[#FF8C42]">
          {provider.fromPrice != null
            ? `₹${Math.round(provider.fromPrice)}`
            : '—'}
        </div>
        <div className="text-xs text-gray-400">{provider.priceLabel}</div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <Card
        role="button"
        tabIndex={0}
        className={cardClass}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {inner}
      </Card>
    );
  }

  return <Card className={cardClass}>{inner}</Card>;
}
