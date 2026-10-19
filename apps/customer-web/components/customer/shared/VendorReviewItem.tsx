'use client';

import { Star } from 'lucide-react';

export type VendorReviewItemData = {
  id: string;
  customerName?: string;
  rating: number;
  comment?: string;
  date: string;
};

function formatReviewDate(raw: string): string {
  const d = new Date(raw);
  if (!raw || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** One customer review row (vendor profile Reviews tab + Overview preview). */
export function VendorReviewItem({ review }: { review: VendorReviewItemData }) {
  const name = review.customerName || 'Anonymous';
  const date = formatReviewDate(review.date);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-lg font-bold text-white shadow-md">
          {review.customerName?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-bold text-gray-900">{name}</h4>
            {date ? <span className="ml-2 flex-shrink-0 text-xs text-gray-500">{date}</span> : null}
          </div>
          <div className="mb-3 flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                aria-hidden
                className={`h-4 w-4 ${i < review.rating ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`}
              />
            ))}
          </div>
          {review.comment ? (
            <p className="text-sm leading-relaxed text-gray-700">{review.comment}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
