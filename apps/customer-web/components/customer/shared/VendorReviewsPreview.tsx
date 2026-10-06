'use client';

import { ChevronRight, Star } from 'lucide-react';
import { VendorReviewItem, type VendorReviewItemData } from './VendorReviewItem';

type VendorReviewsPreviewProps = {
  reviews: VendorReviewItemData[];
  averageRating?: number | null;
  totalReviews?: number | null;
  /** Number of reviews shown in the preview */
  limit?: number;
  onSeeAll: () => void;
};

/** Overview-tab "Recent reviews" block; renders nothing when there are no reviews. */
export function VendorReviewsPreview({
  reviews,
  averageRating,
  totalReviews,
  limit = 2,
  onSeeAll,
}: VendorReviewsPreviewProps) {
  if (reviews.length === 0) return null;

  const average = Number(averageRating ?? 0);
  const showAverage = Number.isFinite(average) && average > 0;

  return (
    <section aria-labelledby="vendor-recent-reviews-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 id="vendor-recent-reviews-heading" className="text-base font-bold text-gray-900">
          Recent reviews
        </h3>
        {showAverage ? (
          <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" aria-hidden />
            {average.toFixed(1)}
            {totalReviews ? <span className="font-normal text-gray-500">({totalReviews})</span> : null}
          </span>
        ) : null}
      </div>

      {reviews.slice(0, limit).map((review) => (
        <VendorReviewItem key={review.id} review={review} />
      ))}

      <button
        type="button"
        onClick={onSeeAll}
        className="flex w-full items-center justify-center gap-1 rounded-xl border border-orange-200 py-2.5 text-sm font-semibold text-[#FF8C42] active:bg-orange-50"
      >
        See all reviews
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </section>
  );
}
