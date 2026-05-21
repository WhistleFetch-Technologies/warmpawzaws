'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { formatSearchDistanceAway } from '@/lib/search-vendor-display';

function categoryEmojiFallback(category: string): string {
  const c = (category || '').toLowerCase();
  if (c.includes('vet') || c.includes('veterinar') || c.includes('clinic')) return '🏥';
  if (c.includes('groom')) return '✂️';
  if (c.includes('train')) return '🎓';
  if (c.includes('board')) return '🏨';
  if (c.includes('walk')) return '🚶';
  if (c.includes('cafe')) return '☕';
  if (c.includes('resort')) return '🏝️';
  if (c.includes('pharma') || c.includes('chemist')) return '💊';
  return '🐾';
}

export interface CustomerSearchListingCardProps {
  title: string;
  /** e.g. service name when title is vendor business name */
  subtitle?: string;
  category: string;
  imageUrl?: string;
  /** Full formatted address line (already merged address / city / state). */
  addressLine: string;
  distanceKm?: number | null;
  rating: number;
  reviewCount: number;
  price?: number;
  /** Shown as small chip (e.g. category label). */
  badgeLabel?: string;
}

/**
 * Mobile search result card: large hero area + white body (matches /search shell in dev).
 * Shows vendor image when available; falls back to category emoji on gradient.
 */
export function CustomerSearchListingCard({
  title,
  subtitle,
  category,
  imageUrl,
  addressLine,
  distanceKm,
  rating,
  reviewCount,
  price,
  badgeLabel,
}: CustomerSearchListingCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const distanceText = formatSearchDistanceAway(distanceKm);
  const safeRating = Number.isFinite(rating) ? rating : 0;
  const emoji = categoryEmojiFallback(category);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const showImage = Boolean(imageUrl?.trim()) && !imageFailed;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer">
      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-orange-100 to-amber-100">
        {showImage ? (
          <img
            key={imageUrl}
            src={imageUrl}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
            referrerPolicy="no-referrer"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="text-5xl leading-none" aria-hidden>
            {emoji}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 leading-snug">{title}</h3>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-gray-600 line-clamp-2">{subtitle}</p>
            ) : null}
            <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-500">
              <MapPin
                className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                strokeWidth={2}
                aria-hidden
              />
              <span className="line-clamp-2 break-words">{addressLine}</span>
            </p>
            {distanceText ? (
              <p className="mt-1.5 pl-5 text-sm font-medium text-emerald-700">{distanceText}</p>
            ) : null}
          </div>
          {price != null && Number.isFinite(price) ? (
            <span className="shrink-0 text-orange-500 font-semibold">₹{price}</span>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-sm">
            <span className="text-yellow-500" aria-hidden>
              ⭐
            </span>
            <span className="font-medium text-gray-900">{safeRating.toFixed(1)}</span>
            <span className="text-gray-400">({reviewCount})</span>
          </div>
          {badgeLabel ? (
            <span className="max-w-[45%] truncate text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
              {badgeLabel}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
