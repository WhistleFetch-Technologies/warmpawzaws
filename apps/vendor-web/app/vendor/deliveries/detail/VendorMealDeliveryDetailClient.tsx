'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import {
  dispatchVendorMealDelivery,
  fetchVendorMealSubscriptionDelivery,
  patchVendorMealDeliveryStatus,
} from '@/lib/meal-subscription-vendor-api';
import { useVendorWebSocket } from '@/hooks/useVendorWebSocket';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { VendorMealPrepScheduleInfo } from '@/components/vendor/nutrition/VendorMealPrepScheduleInfo';
import {
  confirmVendorEarlyMealPrep,
  vendorMealPrepSchedulingFromOrder,
} from '@/lib/vendor-meal-prep-scheduling';

export default function VendorMealDeliveryDetailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deliveryId = searchParams.get('deliveryId') || '';
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const { subscribeToMealSubscriptionDeliveryBroadcast } = useVendorWebSocket(vendorId || undefined);

  const load = useCallback(async () => {
    if (!vendorId || !deliveryId) return;
    try {
      setLoading(true);
      const res = await fetchVendorMealSubscriptionDelivery(vendorId, deliveryId);
      setRow(res.delivery || null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [vendorId, deliveryId]);

  useEffect(() => {
    const vid = localStorage.getItem('vendorId');
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
    const unsub = subscribeToMealSubscriptionDeliveryBroadcast((data: any) => {
      if (data?.mealSubscriptionDeliveryId === deliveryId) load();
    });
    return () => unsub();
  }, [subscribeToMealSubscriptionDeliveryBroadcast, deliveryId, load]);

  if (!deliveryId) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center p-6 text-slate-600 text-sm">
        Missing delivery session id. Open from the deliveries list.
      </div>
    );
  }

  if (!vendorId || loading || !row) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
      </div>
    );
  }

  const addr = row.delivery_address as Record<string, unknown> | undefined;
  const status = String(row.status || '');
  const subLife = String(row.lifecycle_status || '');
  const scheduleOrder: Record<string, unknown> = {
    scheduled_delivery_date: row.delivery_date,
    scheduled_delivery_slot: row.delivery_time_slot,
    delivery_time_slot: row.delivery_time_slot,
    prep_time_minutes: row.prep_time_minutes ?? row.plan_prep_time_minutes,
    prep_minutes: row.prep_minutes,
    prep_started_at: row.prep_started_at,
    expected_ready_at: row.expected_ready_at,
  };

  const sessionOpsDisabled = status === 'paused' || subLife === 'paused';

  const requestPreparing = async () => {
    const scheduling = vendorMealPrepSchedulingFromOrder(scheduleOrder);
    if (!confirmVendorEarlyMealPrep(scheduling)) return;
    try {
      await patchVendorMealDeliveryStatus(vendorId, deliveryId, 'preparing');
      toast.success('Marked preparing');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <VendorHeader title="Delivery session" subtitle={`#${String(row.session_number)}`} />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-slate-200 space-y-3">
          <div className="flex justify-between items-start gap-2">
            <div>
              <p className="text-lg font-bold text-slate-900">{String(row.customer_name || 'Customer')}</p>
              <p className="text-sm text-slate-500">{String(row.customer_phone || '')}</p>
            </div>
            <Badge>{status}</Badge>
          </div>
          {!!row.customer_phone && (
            <a href={`tel:${row.customer_phone}`}>
              <Button type="button" variant="outline" size="sm" className="w-full">
                <Phone className="w-4 h-4 mr-2" /> Call customer
              </Button>
            </a>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-slate-200 space-y-2 text-sm">
          <p>
            <span className="text-slate-500">Meal plan · </span>
            <span className="font-semibold">{String(row.meal_plan_name || '')}</span>
          </p>
          <p>
            <span className="text-slate-500">Qty · </span>
            {String(row.meals_per_delivery || '')}
          </p>
          <VendorMealPrepScheduleInfo
            order={scheduleOrder}
            showAfterPrep={status === 'preparing' || row.prep_started_at != null}
          />
          {addr && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase">Address</p>
              <p className="text-slate-800 whitespace-pre-wrap">{JSON.stringify(addr, null, 2)}</p>
            </div>
          )}
          {row.customer_notes != null && String(row.customer_notes).trim() !== '' && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Customer notes</p>
              <p className="text-slate-800">{String(row.customer_notes)}</p>
            </div>
          )}
          {row.vendor_notes != null && String(row.vendor_notes).trim() !== '' && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Vendor notes</p>
              <p className="text-slate-800">{String(row.vendor_notes)}</p>
            </div>
          )}
        </div>

        {sessionOpsDisabled && (
          <div className="rounded-xl bg-violet-50 border border-violet-200 text-violet-900 text-sm p-3">
            Customer paused this subscription. Ops are disabled until they resume in the customer app.
          </div>
        )}

        <div className={`grid grid-cols-2 gap-2 ${sessionOpsDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <Button type="button" variant="outline" onClick={() => void requestPreparing()}>
            Preparing
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await patchVendorMealDeliveryStatus(vendorId, deliveryId, 'ready');
                toast.success('Marked ready');
                load();
              } catch (e: any) {
                toast.error(e?.message || 'Update failed');
              }
            }}
          >
            Ready
          </Button>
          <Button
            type="button"
            className="col-span-2 bg-orange-500 hover:bg-orange-600"
            onClick={async () => {
              try {
                await dispatchVendorMealDelivery(vendorId, deliveryId);
                toast.success('Dispatched');
                load();
              } catch (e: any) {
                toast.error(e?.message || 'Dispatch failed');
              }
            }}
          >
            Dispatch (meal_subscription_deliveries)
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="col-span-2"
            onClick={async () => {
              try {
                await patchVendorMealDeliveryStatus(vendorId, deliveryId, 'delivered');
                toast.success('Marked delivered');
                load();
              } catch (e: any) {
                toast.error(e?.message || 'Update failed');
              }
            }}
          >
            Mark delivered
          </Button>
        </div>
      </div>
    </div>
  );
}
