'use client';

import { Calendar, ChevronRight, Clock, UtensilsCrossed } from 'lucide-react';
import { sanitizeDisplayImageUrl } from '@/lib/resolve-display-image-url';
import { formatMealSubscriptionDateOnly } from '@/lib/meal-subscription-display';

export interface ActivePlanBannerProps {
  subscription: Record<string, unknown>;
  onViewDetails: () => void;
}

function formatDeliverySchedule(sub: Record<string, unknown>): string {
  const preferred = sub.preferred_delivery_time ?? sub.preferredDeliveryTime;
  if (typeof preferred === 'string' && preferred.trim()) {
    const t = preferred.trim();
    return t.length >= 5 ? t.slice(0, 5) : t;
  }
  const slot = sub.preferred_delivery_slot ?? sub.preferredDeliverySlot;
  if (slot && typeof slot === 'object' && slot !== null) {
    const start = (slot as { start?: string }).start?.trim();
    if (start) return start.length >= 5 ? start.slice(0, 5) : start;
  }
  return '—';
}

export function ActivePlanBanner({ subscription, onViewDetails }: ActivePlanBannerProps) {
  const planName = String(subscription.meal_plan_name || 'Meal plan');
  const total = Number(subscription.total_sessions) || 0;
  const done = Number(subscription.completed_sessions) || 0;
  const currentDay = total > 0 ? Math.min(done + 1, total) : null;
  const img = sanitizeDisplayImageUrl(subscription.meal_plan_image_url);
  const nextDelivery = formatMealSubscriptionDateOnly(subscription.next_delivery_date);
  const deliveryTime = formatDeliverySchedule(subscription);

  return (
    <section
      className="overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50/90 to-orange-50/70 p-4 shadow-sm"
      aria-label="Active meal plan"
    >
      <div className="flex gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-500 text-white shadow-sm">
          {img ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={img} alt="" className="h-full w-full object-cover" />
          ) : (
            <UtensilsCrossed className="h-5 w-5" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-orange-600">Active Plan</p>
          <p className="mt-0.5 truncate text-base font-bold text-slate-900">{planName}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {currentDay != null && total > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-orange-500" aria-hidden />
                Day {currentDay} of {total}
              </span>
            ) : nextDelivery !== '—' ? (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-orange-500" aria-hidden />
                Next: {nextDelivery}
              </span>
            ) : null}
            {deliveryTime !== '—' ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0 text-orange-500" aria-hidden />
                Daily delivery at {deliveryTime}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onViewDetails}
        className="mt-3 flex w-full items-center justify-end gap-0.5 text-sm font-semibold text-orange-600 transition active:text-orange-700"
      >
        View Plan Details
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </section>
  );
}
