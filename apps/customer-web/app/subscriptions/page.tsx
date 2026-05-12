'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, UtensilsCrossed } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { useMealSubscriptionsList } from '@/hooks/useMealSubscriptions';
import type { MealLifecycleFilter } from '@/lib/meal-subscriptions-api';

interface PackageSubscription {
  id: string;
  package_name: string;
  vendor_name: string;
  service_type: string;
  total_sessions: number;
  used_sessions: number;
  remaining_sessions: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'expired' | 'cancelled';
  price: number;
}

const PKG_FILTERS = [
  { id: 'all' as const, label: 'All' },
  { id: 'active' as const, label: 'Active' },
  { id: 'expired' as const, label: 'Expired' },
];

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
  const [tab, setTab] = useState<'meal' | 'packages'>('meal');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [mealFilter, setMealFilter] = useState<MealLifecycleFilter>('all');
  const [pkgFilter, setPkgFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [packages, setPackages] = useState<PackageSubscription[]>([]);
  const [pkgLoading, setPkgLoading] = useState(false);

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

  useEffect(() => {
    if (tab !== 'packages' || !customerId) return;
    let cancelled = false;
    (async () => {
      try {
        setPkgLoading(true);
        const response = await apiClient.get<{ subscriptions: PackageSubscription[] }>(
          `/subscriptions/customer/${customerId}`,
        );
        if (!cancelled) setPackages(response.subscriptions || []);
      } catch (err) {
        console.error('Error loading package subscriptions:', err);
      } finally {
        if (!cancelled) setPkgLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, customerId]);

  const filteredPackages = packages.filter((sub) => {
    if (pkgFilter === 'all') return true;
    if (pkgFilter === 'active') return sub.status === 'active';
    if (pkgFilter === 'expired') return sub.status === 'expired' || sub.status === 'cancelled';
    return true;
  });

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  };

  const loadingMeal = mealQuery.isLoading && tab === 'meal';
  const mealSubs = mealQuery.data || [];

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-x-hidden bg-[var(--color-primary-50)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <header className="shrink-0 border-b border-orange-100/90 bg-orange-50/95 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm">
        <div className="flex items-start gap-2 px-4 pb-3 pt-1">
          <button
            type="button"
            onClick={goBack}
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-800 transition active:bg-white/70 active:scale-[0.97]"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6" strokeWidth={2.25} />
          </button>
          <div className="min-w-0 flex-1 pr-2">
            <h1 className="text-xl font-bold leading-snug tracking-tight text-slate-900 sm:text-[1.35rem]">
              My subscriptions
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">Meal plans &amp; session packages — kept separate</p>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'meal' | 'packages')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-white/90 p-1 shadow-sm ring-1 ring-slate-200/60 mb-4">
            <TabsTrigger value="meal" className="rounded-xl data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <UtensilsCrossed className="w-4 h-4 mr-2" />
              Meal subscriptions
            </TabsTrigger>
            <TabsTrigger value="packages" className="rounded-xl data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <Package className="w-4 h-4 mr-2" />
              Packages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="meal" className="mt-0 pb-8 space-y-4">
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
                  const img = sub.meal_plan_image_url as string | undefined;
                  return (
                    <article
                      key={id}
                      className="w-full overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 cursor-pointer active:scale-[0.99] transition"
                      onClick={() =>
                        router.push(`/subscriptions/detail?id=${encodeURIComponent(id)}`)
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          router.push(`/subscriptions/detail?id=${encodeURIComponent(id)}`);
                      }}
                    >
                      <div className="flex gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-orange-50 ring-1 ring-orange-100">
                          {img ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={img} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <UtensilsCrossed className="h-7 w-7 text-orange-500" />
                            </div>
                          )}
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
                            Next: {sub.next_delivery_date ? String(sub.next_delivery_date) : '—'} ·{' '}
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
          </TabsContent>

          <TabsContent value="packages" className="mt-0 pb-8 space-y-4">
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/90 p-1 shadow-sm ring-1 ring-slate-200/60">
              {PKG_FILTERS.map(({ id, label }) => {
                const selected = pkgFilter === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPkgFilter(id)}
                    className={`min-h-[44px] rounded-xl px-2 text-sm font-semibold transition active:scale-[0.98] ${
                      selected ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:bg-orange-50/80'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {pkgLoading ? (
              <div className="flex justify-center py-16">
                <div className="h-11 w-11 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
              </div>
            ) : filteredPackages.length === 0 ? (
              <div className="flex w-full flex-col items-center justify-center rounded-3xl bg-white px-6 py-14 shadow-sm ring-1 ring-slate-200/60 min-h-[min(420px,55vh)]">
                <Package className="mb-5 h-8 w-8 text-orange-500" strokeWidth={1.75} aria-hidden />
                <p className="text-center text-base font-semibold text-slate-800">No packages found</p>
                <p className="mt-2 max-w-xs text-center text-sm leading-relaxed text-slate-500">
                  Session packs you&apos;ve purchased appear here — separate from recurring meal deliveries.
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/search')}
                  className="mt-8 w-full max-w-sm min-h-[48px] rounded-2xl bg-orange-500 px-6 text-base font-semibold text-white shadow-md transition hover:bg-orange-600 active:scale-[0.99]"
                >
                  Browse packages
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 pb-6">
                {filteredPackages.map((subscription) => {
                  const total = subscription.total_sessions || 1;
                  const pct = Math.min(100, Math.round((subscription.used_sessions / total) * 100));
                  return (
                    <article
                      key={subscription.id}
                      className="w-full overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="text-lg font-bold leading-snug text-slate-900">{subscription.package_name}</h2>
                          <p className="mt-1 text-sm text-slate-500">{subscription.vendor_name}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                            subscription.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {subscription.status}
                        </span>
                      </div>
                      <div className="mt-5">
                        <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
                          <span>Sessions used</span>
                          <span>
                            {subscription.used_sessions} / {subscription.total_sessions}
                          </span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Start</dt>
                          <dd className="mt-0.5 font-semibold text-slate-900">
                            {new Date(subscription.start_date).toLocaleDateString()}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">End</dt>
                          <dd className="mt-0.5 font-semibold text-slate-900">
                            {new Date(subscription.end_date).toLocaleDateString()}
                          </dd>
                        </div>
                      </dl>
                      {subscription.status === 'active' && subscription.remaining_sessions > 0 && (
                        <button
                          type="button"
                          onClick={() => router.push(`/booking/${subscription.id}?type=package`)}
                          className="mt-5 w-full min-h-[48px] rounded-2xl bg-orange-500 text-base font-semibold text-white transition hover:bg-orange-600 active:scale-[0.99]"
                        >
                          Book next session
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
