'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchVendorMealSubscriptionDeliveries,
  patchVendorMealDeliveryStatus,
  dispatchVendorMealDelivery,
} from '@/lib/meal-subscription-vendor-api';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { useVendorWebSocket } from '@/hooks/useVendorWebSocket';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, RefreshCw, Truck } from 'lucide-react';
import { toast } from 'sonner';

type GroupBy = 'slot' | 'area' | 'subscription' | 'status';

const STATUS_FILTERS = [
  'all',
  'scheduled',
  'preparing',
  'ready',
  'assigned',
  'out_for_delivery',
  'delivered',
  'skipped',
  'rescheduled',
  'cancelled',
  'failed',
  'dispatched',
];

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pinFromRow(row: Record<string, unknown>): string {
  const addr = row.delivery_address;
  if (addr && typeof addr === 'object' && 'pincode' in (addr as object)) {
    return String((addr as { pincode?: string }).pincode || '');
  }
  return '';
}

export default function VendorMealDeliveriesPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [scope, setScope] = useState<'today' | 'upcoming' | 'queue'>('today');
  const [groupBy, setGroupBy] = useState<GroupBy>('slot');

  const { subscribeToMealSubscriptionDeliveryBroadcast } = useVendorWebSocket(vendorId || undefined);

  const load = useCallback(async () => {
    if (!vendorId) return;
    try {
      setLoading(true);
      const today = todayYmd();
      const dateFrom = scope === 'today' ? today : scope === 'upcoming' ? today : undefined;
      const dateTo = scope === 'today' ? today : undefined;
      const res = await fetchVendorMealSubscriptionDeliveries(vendorId, {
        status: filter === 'all' ? undefined : filter,
        dateFrom,
        dateTo,
        limit: 150,
      });
      let list = res.deliveries || [];
      if (scope === 'queue') {
        list = list.filter((r) =>
          ['scheduled', 'preparing', 'ready', 'assigned'].includes(String(r.status)),
        );
      }
      if (scope === 'upcoming') {
        list = list.filter((r) => String(r.delivery_date) >= today);
      }
      setRows(list);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, [vendorId, filter, scope]);

  useEffect(() => {
    const vid = typeof window !== 'undefined' ? localStorage.getItem('vendorId') : null;
    if (!vid) {
      router.push('/auth');
      return;
    }
    setVendorId(vid);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsub = subscribeToMealSubscriptionDeliveryBroadcast(() => {
      load();
    });
    return () => unsub();
  }, [subscribeToMealSubscriptionDeliveryBroadcast, load]);

  const grouped = useMemo(() => {
    const map = new Map<string, Record<string, unknown>[]>();
    for (const r of rows) {
      let key = '';
      if (groupBy === 'status') key = String(r.status || 'unknown');
      else if (groupBy === 'subscription') key = String(r.subscription_id || 'unknown');
      else if (groupBy === 'area') key = pinFromRow(r) || 'unknown-pin';
      else {
        const slot = r.delivery_time_slot as { start?: string } | undefined;
        key = slot?.start || 'slot';
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows, groupBy]);

  const setStatus = async (deliveryId: string, status: string) => {
    if (!vendorId) return;
    try {
      await patchVendorMealDeliveryStatus(vendorId, deliveryId, status);
      toast.success(`Marked ${status}`);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    }
  };

  const dispatch = async (deliveryId: string) => {
    if (!vendorId) return;
    try {
      await dispatchVendorMealDelivery(vendorId, deliveryId);
      toast.success('Dispatched (logistics handoff queued)');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Dispatch failed');
    }
  };

  if (!vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <VendorHeader title="Meal · Sessions" subtitle="Canonical subscription deliveries" />
      <div className="max-w-5xl mx-auto px-4 pt-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200 shadow-sm">
            {(['today', 'upcoming', 'queue'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
                  scope === s ? 'bg-orange-500 text-white shadow' : 'text-slate-600 hover:bg-orange-50'
                }`}
              >
                {s === 'queue' ? 'Queue' : s}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px] bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="w-[200px] bg-white">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slot">By slot</SelectItem>
              <SelectItem value="area">By pincode</SelectItem>
              <SelectItem value="subscription">By subscription</SelectItem>
              <SelectItem value="status">By status</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(([key, list]) => (
              <section key={key}>
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">{key}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {list.map((row) => {
                    const id = String(row.id);
                    const st = String(row.status || '');
                    const slot = row.delivery_time_slot as { start?: string; end?: string } | undefined;
                    return (
                      <div
                        key={id}
                        className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 space-y-2 cursor-pointer"
                        onClick={() =>
                          router.push(`/vendor/deliveries/detail?deliveryId=${encodeURIComponent(id)}`)
                        }
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')
                            router.push(`/vendor/deliveries/detail?deliveryId=${encodeURIComponent(id)}`);
                        }}
                      >
                        <div className="flex justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">{String(row.customer_name || 'Customer')}</p>
                            <p className="text-xs text-slate-500">
                              Session #{String(row.session_number)} · {String(row.meal_plan_name || '')}
                            </p>
                          </div>
                          <Badge variant="secondary">{st}</Badge>
                        </div>
                        <p className="text-sm text-slate-600">
                          {String(row.delivery_date)} · {slot?.start}–{slot?.end}
                        </p>
                        <p className="text-xs text-slate-500">Qty {String(row.meals_per_delivery || '')}</p>
                        <div className="flex flex-wrap gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" onClick={() => setStatus(id, 'preparing')}>
                            Preparing
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setStatus(id, 'ready')}>
                            Ready
                          </Button>
                          <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => dispatch(id)}>
                            <Truck className="w-4 h-4 mr-1" /> Dispatch
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setStatus(id, 'delivered')}>
                            Delivered
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
            {rows.length === 0 && (
              <p className="text-center text-slate-500 py-12">No subscription delivery sessions in this view.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
