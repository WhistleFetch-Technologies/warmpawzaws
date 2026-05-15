'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';

interface Subscription {
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

const FILTERS = [
  { id: 'all' as const, label: 'All' },
  { id: 'active' as const, label: 'Active' },
  { id: 'expired' as const, label: 'Expired' },
];

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');

  useEffect(() => {
    const phone = localStorage.getItem('customerPhone');
    if (!phone) {
      router.push('/auth');
      return;
    }
    loadSubscriptions();
  }, [router]);

  const loadSubscriptions = async () => {
    try {
      const customerId = getResolvedCustomerId();
      if (customerId) {
        const response = await apiClient.get<{ subscriptions: Subscription[] }>(
          `/subscriptions/customer/${customerId}`
        );
        setSubscriptions(response.subscriptions || []);
      }
    } catch (err) {
      console.error('Error loading subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubscriptions = subscriptions.filter((sub) => {
    if (filter === 'all') return true;
    if (filter === 'active') return sub.status === 'active';
    if (filter === 'expired') return sub.status === 'expired' || sub.status === 'cancelled';
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-800';
      case 'expired':
        return 'bg-slate-100 text-slate-700';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[var(--color-primary-50)] px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div
          className="h-11 w-11 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500"
          aria-hidden
        />
        <p className="mt-4 text-sm font-medium text-slate-600">Loading subscriptions…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-x-hidden bg-[var(--color-primary-50)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {/* App-style top bar */}
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
              Subscriptions &amp; packages
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">Session packs you&apos;ve purchased</p>
          </div>
        </div>

        {/* Full-width segmented control (mobile-native pattern) */}
        <div className="px-4 pb-3">
          <div
            className="grid grid-cols-3 gap-1 rounded-2xl bg-white/90 p-1 shadow-sm ring-1 ring-slate-200/60"
            role="tablist"
            aria-label="Filter subscriptions"
          >
            {FILTERS.map(({ id, label }) => {
              const selected = filter === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(id)}
                  className={`min-h-[44px] rounded-xl px-2 text-sm font-semibold transition active:scale-[0.98] ${
                    selected
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-orange-50/80'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-4 pt-4">
        {filteredSubscriptions.length === 0 ? (
          <div className="flex flex-1 flex-col">
            <div className="flex w-full flex-1 flex-col items-center justify-center rounded-3xl bg-white px-6 py-14 shadow-sm ring-1 ring-slate-200/60 min-h-[min(420px,55vh)]">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-3xl">
                <Package className="h-8 w-8 text-orange-500" strokeWidth={1.75} aria-hidden />
              </div>
              <p className="text-center text-base font-semibold text-slate-800">No subscriptions found</p>
              <p className="mt-2 max-w-xs text-center text-sm leading-relaxed text-slate-500">
                When you buy a package, it will show up here so you can track sessions and book.
              </p>
              <button
                type="button"
                onClick={() => router.push('/search')}
                className="mt-8 w-full max-w-sm min-h-[48px] rounded-2xl bg-orange-500 px-6 text-base font-semibold text-white shadow-md transition hover:bg-orange-600 active:scale-[0.99] active:bg-orange-600"
              >
                Browse packages
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-6">
            {filteredSubscriptions.map((subscription) => {
              const total = subscription.total_sessions || 1;
              const pct = Math.min(100, Math.round((subscription.used_sessions / total) * 100));
              return (
                <article
                  key={subscription.id}
                  className="w-full overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-bold leading-snug text-slate-900">
                        {subscription.package_name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">{subscription.vendor_name}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${getStatusColor(subscription.status)}`}
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
                      <div
                        className="h-full rounded-full bg-orange-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
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
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Remaining</dt>
                      <dd className="mt-0.5 font-semibold text-orange-600">
                        {subscription.remaining_sessions} sessions
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Price</dt>
                      <dd className="mt-0.5 font-semibold text-slate-900">₹{subscription.price}</dd>
                    </div>
                  </dl>

                  {subscription.status === 'active' && subscription.remaining_sessions > 0 && (
                    <button
                      type="button"
                      onClick={() => router.push(`/booking/${subscription.id}?type=package`)}
                      className="mt-5 w-full min-h-[48px] rounded-2xl bg-orange-500 text-base font-semibold text-white transition hover:bg-orange-600 active:scale-[0.99] active:bg-orange-600"
                    >
                      Book next session
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
