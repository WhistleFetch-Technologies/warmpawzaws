'use client';

import { ChevronRight, Star } from 'lucide-react';

export interface MealTrackingRatingFooterProps {
  onRate: () => void;
  alreadyRated?: boolean;
}

export function MealTrackingRatingFooter({ onRate, alreadyRated }: MealTrackingRatingFooterProps) {
  if (alreadyRated) {
    return (
      <section className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-4 text-center">
        <p className="flex items-center justify-center gap-1 text-sm font-medium text-amber-900">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
          Thank you for your feedback!
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-orange-200/80 bg-gradient-to-r from-orange-50 via-amber-50/90 to-orange-50 px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 gap-0.5 text-amber-400" aria-hidden>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className="h-4 w-4" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">How was your experience?</p>
          <p className="text-xs text-slate-600">Rate your meal &amp; help us improve.</p>
        </div>
        <button
          type="button"
          onClick={onRate}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white px-3 py-2 text-xs font-bold text-orange-600 shadow-sm ring-1 ring-orange-200 transition active:scale-[0.98]"
        >
          Rate Now
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
