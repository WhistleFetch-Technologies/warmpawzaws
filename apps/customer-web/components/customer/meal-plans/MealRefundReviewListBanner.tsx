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
  if (!['pending_review', 'refund_processing', 'refunded'].includes(refundReview.status)) {
    return null;
  }

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
          {refundReview.recommendedAmount != null &&
          ['refund_processing', 'refunded'].includes(refundReview.status) ? (
            <p className="mt-1 text-sm font-semibold text-amber-900">
              Refund amount: ₹
              {refundReview.recommendedAmount.toLocaleString('en-IN', {
                maximumFractionDigits: 2,
              })}
            </p>
          ) : null}
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
    refundReview.status === 'approved' ||
    refundReview.status === 'refunded' ||
    refundReview.status === 'refund_processing'
      ? CheckCircle
      : refundReview.status === 'rejected'
        ? XCircle
        : Clock;

  const border =
    refundReview.status === 'approved' ||
    refundReview.status === 'refunded' ||
    refundReview.status === 'refund_processing'
      ? 'border-emerald-200 bg-emerald-50'
      : refundReview.status === 'rejected'
        ? 'border-red-200 bg-red-50'
        : 'border-amber-200 bg-amber-50';

  const iconBg =
    refundReview.status === 'approved' ||
    refundReview.status === 'refunded' ||
    refundReview.status === 'refund_processing'
      ? 'bg-emerald-100 text-emerald-700'
      : refundReview.status === 'rejected'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700';

  const title =
    refundReview.status === 'pending_review'
      ? 'Refund review'
      : refundReview.status === 'approved'
        ? 'Refund approved'
        : refundReview.status === 'refund_processing'
          ? 'Refund processing'
          : refundReview.status === 'refunded'
            ? 'Refund completed'
            : refundReview.status === 'refund_failed'
              ? 'Refund issue'
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
              {['refund_processing', 'refunded'].includes(refundReview.status)
                ? 'Refund amount: '
                : 'Refund amount (estimate): '}
              ₹{refundReview.recommendedAmount.toLocaleString('en-IN')}
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
