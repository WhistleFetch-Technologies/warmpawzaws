'use client';

import { Star } from 'lucide-react';
import { getAverageRatingLabel, getReviewCountLabel, hasRatings, normalizeRatingCount } from '@/lib/rating-display';

interface StarRatingProps {
  rating: unknown;
  reviewCount: unknown;
  className?: string;
  starsClassName?: string;
  textClassName?: string;
  showNumericRating?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function StarRating({
  rating,
  reviewCount,
  className = '',
  starsClassName = 'h-4 w-4',
  textClassName = 'text-sm text-gray-600',
  showNumericRating = true,
}: StarRatingProps) {
  const count = normalizeRatingCount(reviewCount);
  const showRatedState = hasRatings(count);
  const numericRating = Number(rating);
  const safeRating = Number.isFinite(numericRating) ? clamp(numericRating, 0, 5) : 0;
  const fillPercent = showRatedState ? (safeRating / 5) * 100 : 0;
  const avgLabel = getAverageRatingLabel(safeRating, count);
  const reviewLabel = getReviewCountLabel(count);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative inline-flex items-center gap-0.5">
        {[0, 1, 2, 3, 4].map((index) => (
          <Star key={`bg-${index}`} className={`${starsClassName} text-gray-300`} />
        ))}
        <div
          className="absolute left-0 top-0 inline-flex items-center gap-0.5 overflow-hidden"
          style={{ width: `${fillPercent}%` }}
        >
          {[0, 1, 2, 3, 4].map((index) => (
            <Star key={`fill-${index}`} className={`${starsClassName} fill-amber-400 text-amber-400`} />
          ))}
        </div>
      </div>

      <span className={textClassName}>
        {showRatedState ? (
          <>
            {showNumericRating ? <span className="font-semibold text-gray-900">{avgLabel}</span> : null}
            {showNumericRating ? ' · ' : ''}
            <span>{reviewLabel}</span>
          </>
        ) : (
          reviewLabel
        )}
      </span>
    </div>
  );
}

export default StarRating;
