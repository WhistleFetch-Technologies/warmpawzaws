/** Customer-safe meal refund review metadata from API (no case IDs). */

export type MealRefundReviewStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'refund_processing'
  | 'refunded'
  | 'refund_failed';

export type MealRefundReviewMetadata = {
  status: MealRefundReviewStatus;
  message: string;
  recommendedAmount?: number;
  createdAt?: string;
};

export function parseMealRefundReview(raw: unknown): MealRefundReviewMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const status = String(o.status || '').trim() as MealRefundReviewStatus;
  if (
    ![
      'pending_review',
      'approved',
      'rejected',
      'refund_processing',
      'refunded',
      'refund_failed',
    ].includes(status)
  ) {
    return null;
  }
  const message = String(o.message || '').trim();
  if (!message) return null;
  const recommendedAmount =
    o.recommendedAmount != null
      ? Number(o.recommendedAmount)
      : o.recommended_amount != null
        ? Number(o.recommended_amount)
        : undefined;
  const createdAt =
    o.createdAt != null
      ? String(o.createdAt)
      : o.created_at != null
        ? String(o.created_at)
        : undefined;
  return {
    status,
    message,
    ...(recommendedAmount != null &&
    Number.isFinite(recommendedAmount) &&
    recommendedAmount > 0
      ? { recommendedAmount }
      : {}),
    ...(createdAt ? { createdAt } : {}),
  };
}

export function mealRefundReviewListTitle(status: MealRefundReviewStatus): string {
  switch (status) {
    case 'pending_review':
      return 'Refund under review';
    case 'approved':
      return 'Refund approved';
    case 'rejected':
      return 'Refund not approved';
    case 'refund_processing':
      return 'Refund processing';
    case 'refunded':
      return 'Refund completed';
    case 'refund_failed':
      return 'Refund issue';
    default:
      return 'Refund update';
  }
}

export function formatMealRefundReviewDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
