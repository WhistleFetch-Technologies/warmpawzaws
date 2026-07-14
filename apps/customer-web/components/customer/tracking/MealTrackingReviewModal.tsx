'use client';

import { Loader2, Star, X } from 'lucide-react';

export interface MealTrackingReviewModalProps {
  open: boolean;
  onClose: () => void;
  rating: number;
  onRatingChange: (n: number) => void;
  reviewText: string;
  onReviewTextChange: (text: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function MealTrackingReviewModal({
  open,
  onClose,
  rating,
  onRatingChange,
  reviewText,
  onReviewTextChange,
  onSubmit,
  submitting,
}: MealTrackingReviewModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-review-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id="meal-review-title" className="text-lg font-bold text-gray-900">
            Rate Your Experience
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="mb-4 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onRatingChange(n)}
              className={`rounded-full p-2 transition ${
                rating >= n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400'
              }`}
              aria-label={`Rate ${n} stars`}
            >
              <Star className={`h-6 w-6 ${rating >= n ? 'fill-current' : ''}`} />
            </button>
          ))}
        </div>
        <textarea
          placeholder="Optional: share your experience..."
          value={reviewText}
          onChange={(e) => onReviewTextChange(e.target.value)}
          className="mb-4 h-24 w-full resize-none rounded-xl border border-gray-200 p-3 text-sm"
          maxLength={500}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || rating < 1}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          Submit Review
        </button>
      </div>
    </div>
  );
}
