'use client';

import { AlertCircle, Check, Clock, Truck } from 'lucide-react';
import type { MealTrackingHeroVariant } from '@/components/customer/tracking/meal-tracking-display';
import {
  formatTrackingDateLabel,
  formatTrackingTimeOnly,
} from '@/components/customer/tracking/meal-tracking-display';

export interface MealTrackingStatusHeroProps {
  variant: MealTrackingHeroVariant;
  mealPlanName: string;
  deliveredAt?: string | null;
  etaMinutes?: number | null;
}

export function MealTrackingStatusHero({
  variant,
  mealPlanName,
  deliveredAt,
  etaMinutes,
}: MealTrackingStatusHeroProps) {
  const dateLabel = formatTrackingDateLabel(deliveredAt);
  const timeLabel = formatTrackingTimeOnly(deliveredAt);

  if (variant === 'delivered') {
    return (
      <section
        className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50/80 p-4 shadow-sm"
        aria-label="Delivery status"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
            <Check className="h-6 w-6 stroke-[2.5]" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-emerald-800">Delivered</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{mealPlanName}</p>
            {dateLabel || timeLabel ? (
              <p className="mt-2 text-xs text-slate-600">
                Delivered {dateLabel ?? ''}
                {timeLabel ? ` · ${timeLabel}` : ''}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'cancelled') {
    return (
      <section
        className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm"
        aria-label="Order cancelled"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-red-900">Order Cancelled</p>
            <p className="mt-1 text-sm text-red-800/90">This order has been cancelled.</p>
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'out_for_delivery') {
    return (
      <section
        className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-emerald-50/60 p-4 shadow-sm"
        aria-label="Out for delivery"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-500 text-white shadow-sm">
            <Truck className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-teal-900">Your meal is on the way</p>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-700">{mealPlanName}</p>
            {etaMinutes != null && Number.isFinite(Number(etaMinutes)) ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-800">
                <Clock className="h-4 w-4" aria-hidden />
                ETA {Math.round(Number(etaMinutes))} mins
              </p>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-slate-50 p-4 shadow-sm"
      aria-label="Preparing order"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm">
          <Clock className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-slate-900">Preparing your meal</p>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-700">{mealPlanName}</p>
          <p className="mt-2 text-sm text-slate-600">Your meal is being freshly prepared.</p>
        </div>
      </div>
    </section>
  );
}
