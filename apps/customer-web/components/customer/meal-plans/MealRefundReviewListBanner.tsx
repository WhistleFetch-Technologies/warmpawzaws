'use client';

import { Clock, CheckCircle, XCircle } from 'lucide-react';
import {
  type MealRefundReviewMetadata,
  mealRefundReviewListTitle,
} from '@/lib/meal-refund-review';

export function MealRefundReviewListBanner({
  refundReview,
}: {
  refundReview: MealRefundReviewMetadata;
}) {
  if (refundReview.status !== 'pending_review') return null;

  return (
    <div
      className="mt-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3"
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <Clock className="h-5 w-5 text-amber-700" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">
            {mealRefundReviewListTitle(refundReview.status)}
          </p>
          <p className="mt-0.5 text-sm text-amber-800/90">{refundReview.message}</p>
        </div>
      </div>
    </div>
  );
}

export function MealRefundReviewTrackingCard({
  refundReview,
}: {
  refundReview: MealRefundReviewMetadata;
}) {
  const Icon =
    refundReview.status === 'approved' || refundReview.status === 'refunded'
      ? CheckCircle
      : refundReview.status === 'rejected'
        ? XCircle
        : Clock;

  const border =
    refundReview.status === 'approved' || refundReview.status === 'refunded'
      ? 'border-emerald-200 bg-emerald-50'
      : refundReview.status === 'rejected'
        ? 'border-red-200 bg-red-50'
        : 'border-amber-200 bg-amber-50';

  const iconBg =
    refundReview.status === 'approved' || refundReview.status === 'refunded'
      ? 'bg-emerald-100 text-emerald-700'
      : refundReview.status === 'rejected'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700';

  const title =
    refundReview.status === 'pending_review'
      ? 'Refund review'
      : refundReview.status === 'approved'
        ? 'Refund approved'
        : refundReview.status === 'rejected'
          ? 'Refund update'
          : 'Refund status';

  return (
    <section
      className={`rounded-2xl border p-4 shadow-sm ${border}`}
      role="status"
      aria-label="Refund review status"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-bold text-slate-900">{title}</p>
            <p className="mt-1 text-sm text-slate-700">{refundReview.message}</p>
          </div>
          {refundReview.recommendedAmount != null &&
          refundReview.recommendedAmount > 0 ? (
            <p className="text-sm font-medium text-slate-800">
              Refund amount (estimate): ₹
              {refundReview.recommendedAmount.toLocaleString('en-IN')}
            </p>
          ) : null}
          {refundReview.createdAt ? (
            <p className="text-xs text-slate-500">
              Requested{' '}
              {new Date(refundReview.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
