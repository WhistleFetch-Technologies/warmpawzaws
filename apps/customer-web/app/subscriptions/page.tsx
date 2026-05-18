'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UtensilsCrossed } from 'lucide-react';
import { useMealSubscriptionsList } from '@/hooks/useMealSubscriptions';
import type { MealLifecycleFilter } from '@/lib/meal-subscriptions-api';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { formatMealSubscriptionDateOnly } from '@/lib/meal-subscription-display';
import { sanitizeDisplayImageUrl } from '@/lib/resolve-display-image-url';

function SubscriptionPlanThumb({ imageUrl }: { imageUrl: string | undefined }) {
  const [broken, setBroken] = React.useState(false);
  if (!imageUrl || broken) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <UtensilsCrossed className="h-7 w-7 text-orange-500" />
      </div>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={imageUrl}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setBroken(true)}
    />
  );
}

const MEAL_FILTERS: { id: MealLifecycleFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'completed', label: 'Completed' },
  { id: 'expired', label: 'Expired' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function SubscriptionsPage() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [mealFilter, setMealFilter] = useState<MealLifecycleFilter>('all');

  const mealQuery = useMealSubscriptionsList(customerId, mealFilter);

  useEffect(() => {
    const phone = localStorage.getItem('customerPhone');
    if (!phone) {
      router.push('/auth');
      return;
    }
    const cid = getResolvedCustomerId();
    setCustomerId(cid || null);
  }, [router]);

  const loadingMeal = mealQuery.isLoading;
  const mealSubs = mealQuery.data || [];

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-x-hidden bg-[var(--color-primary-50)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <header className="shrink-0 border-b border-orange-100/90 bg-orange-50/95 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm">
        <div className="flex items-start gap-2 px-4 pb-3 pt-1">
          <button
            type="button"
            onClick={() => router.push('/orders/meal-plans')}
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-800 transition active:bg-white/70 active:scale-[0.97]"
            aria-label="Back to meal plan orders and tracking"
          >
            <ArrowLeft className="h-6 w-6" strokeWidth={2.25} />
          </button>
          <div className="min-w-0 flex-1 pr-2">
            <h1 className="text-xl font-bold leading-snug tracking-tight text-slate-900 sm:text-[1.35rem]">
              My subscriptions
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">Meal plans &amp; session packages</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4">
        <div className="mt-0 pb-8 space-y-4">
          <div className="flex flex-wrap gap-2">
            {MEAL_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMealFilter(id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  mealFilter === id ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loadingMeal ? (
            <div className="flex justify-center py-16">
              <div className="h-11 w-11 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
            </div>
          ) : mealSubs.length === 0 ? (
            <div className="rounded-3xl bg-white px-6 py-14 shadow-sm ring-1 ring-slate-200/60 text-center">
              <UtensilsCrossed className="mx-auto h-10 w-10 text-orange-400 mb-4" />
              <p className="font-semibold text-slate-800">No meal subscriptions yet</p>
              <p className="mt-2 text-sm text-slate-500">
                Subscribe from a nutrition vendor&apos;s weekly or monthly meal plan — separate from one-time orders.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {mealSubs.map((raw) => {
                const sub = raw as Record<string, unknown>;
                const id = String(sub.id);
                const total = Number(sub.total_sessions) || 0;
                const done = Number(sub.completed_sessions) || 0;
                const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
                const img = sanitizeDisplayImageUrl(sub.meal_plan_image_url);
                return (
                  <article
                    key={id}
                    className="w-full overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 cursor-pointer active:scale-[0.99] transition"
                    onClick={() => router.push(`/subscriptions/detail?id=${encodeURIComponent(id)}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        router.push(`/subscriptions/detail?id=${encodeURIComponent(id)}`);
                    }}
                  >
                    <div className="flex gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-orange-50 ring-1 ring-orange-100">
                        <SubscriptionPlanThumb imageUrl={img} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-2">
                          <h2 className="text-lg font-bold text-slate-900 truncate">
                            {String(sub.meal_plan_name || 'Meal plan')}
                          </h2>
                          <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-800">
                            Sub
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 truncate">{String(sub.vendor_name || '')}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Next: {formatMealSubscriptionDateOnly(sub.next_delivery_date)} ·{' '}
                          {String(sub.purchase_type || '').replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
                        <span>Sessions</span>
                        <span>
                          {done} / {total || '—'}
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                        {String(sub.lifecycle_status || sub.status || '')}
                      </span>
                      {sub.auto_renew ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
                          Auto-renew
                        </span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
