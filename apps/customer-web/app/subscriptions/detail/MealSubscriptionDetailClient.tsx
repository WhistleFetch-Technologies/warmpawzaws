'use client';

import React, { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  downloadMealOrderInvoice,
  getMealOrderInvoiceDownloadMessage,
} from '@/lib/meal-order-invoice-download';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import {
  useMealSubscriptionDeliveriesQuery,
  useMealSubscriptionDetail,
  mealSubscriptionKeys,
  useInvalidateMealSubscriptions,
} from '@/hooks/useMealSubscriptions';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useQueryClient } from '@tanstack/react-query';
import { pauseMealSubscription, resumeMealSubscription, rescheduleMealDelivery } from '@/lib/meal-subscriptions-api';
import { formatMealSubscriptionDateOnly, formatMealSubscriptionSessionLine } from '@/lib/meal-subscription-display';
import { sanitizeDisplayImageUrl } from '@/lib/resolve-display-image-url';

function sessionStatusClass(status: string) {
  const s = status?.toLowerCase() || '';
  if (s === 'delivered') return 'bg-emerald-100 text-emerald-900';
  if (s === 'skipped' || s === 'cancelled') return 'bg-slate-200 text-slate-800';
  if (s === 'paused') return 'bg-violet-100 text-violet-900';
  if (s === 'out_for_delivery' || s === 'assigned') return 'bg-blue-100 text-blue-900';
  return 'bg-orange-50 text-orange-900';
}

export default function MealSubscriptionDetailClient({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter();
  const customerId = typeof window !== 'undefined' ? getResolvedCustomerId() : null;
  const qc = useQueryClient();
  const invalidate = useInvalidateMealSubscriptions();

  const subQ = useMealSubscriptionDetail(customerId, subscriptionId);
  const delQ = useMealSubscriptionDeliveriesQuery(customerId, subscriptionId);

  const { subscribeToMealSubscriptionDeliveryBroadcast } = useWebSocket(customerId || undefined, 'customer');

  useEffect(() => {
    const unsub = subscribeToMealSubscriptionDeliveryBroadcast((data: any) => {
      if (data?.subscriptionId === subscriptionId && customerId) {
        qc.invalidateQueries({ queryKey: mealSubscriptionKeys.deliveries(customerId, subscriptionId) });
        qc.invalidateQueries({ queryKey: mealSubscriptionKeys.detail(customerId, subscriptionId) });
      }
    });
    return () => unsub();
  }, [subscribeToMealSubscriptionDeliveryBroadcast, subscriptionId, customerId, qc]);

  const sub = subQ.data as Record<string, unknown> | null | undefined;
  const deliveries = delQ.data?.deliveries || [];

  const progress = useMemo(() => {
    const total = Number(sub?.total_sessions) || 0;
    const done = Number(sub?.completed_sessions) || 0;
    const skipped = Number(sub?.skipped_sessions) || 0;
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    return { total, done, skipped, pct };
  }, [sub]);

  const onPause = async () => {
    if (!customerId) return;
    try {
      await pauseMealSubscription(subscriptionId, customerId);
      toast.success('Subscription paused');
      invalidate(customerId);
      subQ.refetch();
      delQ.refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Pause failed');
    }
  };

  const onResume = async () => {
    if (!customerId) return;
    try {
      await resumeMealSubscription(subscriptionId, customerId);
      toast.success('Subscription resumed');
      invalidate(customerId);
      subQ.refetch();
      delQ.refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Resume failed');
    }
  };

  const handleDownloadSessionInvoice = async (mealOrderId: string) => {
    try {
      const { saveResult } = await downloadMealOrderInvoice(mealOrderId);
      if (saveResult === 'failed') {
        toast.error(getMealOrderInvoiceDownloadMessage(saveResult));
      } else {
        toast.success(getMealOrderInvoiceDownloadMessage(saveResult));
      }
    } catch (e: unknown) {
      console.error('[MealSubscriptionDetail] invoice download failed:', e);
      toast.error(e instanceof Error ? e.message : 'Failed to download invoice');
    }
  };

  if (!customerId) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <p className="text-slate-600">Please log in to view this subscription.</p>
      </div>
    );
  }

  if (subQ.isLoading || !sub) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
        <p className="text-sm text-slate-600">Loading subscription…</p>
      </div>
    );
  }

  const lifecycle = String(sub.lifecycle_status || sub.status || '');
  const planName = String(sub.meal_plan_name || 'Meal subscription');
  const vendorName = String(sub.vendor_name || 'Vendor');
  const planImage = sanitizeDisplayImageUrl(sub.meal_plan_image_url);

  return (
    <div className="min-h-[100dvh] bg-orange-50/90 pb-24">
      <header className="sticky top-0 z-10 border-b border-orange-100 bg-orange-50/95 backdrop-blur pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => router.push('/orders/meal-plans')}
            className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/80"
            aria-label="Back to meal tracking"
          >
            <ArrowLeft className="h-6 w-6 text-slate-800" />
          </button>
          <div className="min-w-0 flex-1 flex items-center gap-2">
            {planImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={planImage}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-orange-100"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold text-slate-900 truncate">{planName}</h1>
              <p className="text-xs text-slate-500 truncate">{vendorName}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              subQ.refetch();
              delQ.refetch();
            }}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="px-4 pt-4 space-y-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 space-y-3">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <Badge className={lifecycle === 'active' ? 'bg-emerald-500' : 'bg-slate-600'}>{lifecycle}</Badge>
            <span className="text-xs font-medium text-slate-500">
              {String(sub.purchase_type || '').replace(/_/g, ' ')}
            </span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Next delivery</p>
            <p className="font-semibold text-slate-900">
              {formatMealSubscriptionDateOnly(sub.next_delivery_date)}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Progress</span>
              <span>
                {progress.done} done · {progress.skipped} skipped · {progress.total || '∞'} total
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-orange-500" style={{ width: `${progress.pct}%` }} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            {lifecycle === 'active' ? (
              <Button type="button" variant="secondary" className="flex-1" onClick={onPause}>
                Pause
              </Button>
            ) : lifecycle === 'paused' ? (
              <Button type="button" className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={onResume}>
                Resume
              </Button>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 px-1">Meal Plan sessions</h2>
          {deliveries.length === 0 ? (
            <p className="text-sm text-slate-600 px-1">No Meal Plan sessions loaded yet. Pull to refresh.</p>
          ) : (
            <ul className="space-y-3">
              {deliveries.map((d: Record<string, unknown>) => {
                const id = String(d.id);
                const mealOrderId = d.meal_order_id ? String(d.meal_order_id) : '';
                const slot = d.delivery_time_slot as { start?: string; end?: string } | undefined;
                const st = String(d.status || '');
                return (
                  <li
                    key={id}
                    className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 space-y-2"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-slate-900">Meal Plan session {String(d.session_number)}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${sessionStatusClass(st)}`}>
                        {st}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {formatMealSubscriptionSessionLine(d.delivery_date, slot)}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {mealOrderId ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDownloadSessionInvoice(mealOrderId)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Invoice
                        </Button>
                      ) : null}
                      {lifecycle === 'active' &&
                        ['scheduled', 'preparing', 'rescheduled'].includes(st) &&
                        customerId && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const raw = window.prompt('New delivery date (YYYY-MM-DD)');
                              if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return;
                              try {
                                await rescheduleMealDelivery(id, customerId, raw.trim());
                                toast.success('Rescheduled — your vendor has been notified');
                                delQ.refetch();
                                subQ.refetch();
                              } catch (e: any) {
                                toast.error(e?.message || 'Reschedule failed');
                              }
                            }}
                          >
                            Reschedule
                          </Button>
                        )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
