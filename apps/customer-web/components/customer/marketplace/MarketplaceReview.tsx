'use client';

import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MARKETPLACE_CARD_CLASS } from '@/lib/marketplace/types';

export function MarketplaceReview({
  vendorName,
  onRate,
  existingRating,
}: {
  vendorName?: string;
  onRate?: () => void;
  existingRating?: number;
}) {
  return (
    <div className={`${MARKETPLACE_CARD_CLASS} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Rate your experience</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {vendorName ? `How was ${vendorName}?` : 'Share feedback to help other pet parents'}
          </p>
        </div>
        {existingRating != null ? (
          <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-sm">
            <Star className="h-4 w-4 fill-amber-400" />
            {existingRating}/5
          </span>
        ) : onRate ? (
          <Button type="button" size="sm" className="rounded-xl bg-orange-500" onClick={onRate}>
            Review
          </Button>
        ) : null}
      </div>
    </div>
  );
}
