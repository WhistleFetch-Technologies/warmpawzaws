'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { HOME_POLL_PROFILE, isDocumentHidden, pollBackoffMs } from '@/lib/home-poll-profile';
import { isCustomerMealPlansEnabled } from '@/lib/customer-meal-plans-flag';
import { resolveEffectiveMealDeliveryState } from '@warmpawz/shared-types';
import {
  normalizeMealFooterStatus,
  readMealFooterDismissed,
  writeMealFooterDismissed,
  type MealFooterActiveOrder,
} from '@/lib/meal-order-footer-toast';

function extractOrdersArray(res: unknown): Record<string, unknown>[] {
  const r = res as { orders?: unknown[]; data?: { orders?: unknown[] } };
  if (Array.isArray(r?.orders)) return r.orders as Record<string, unknown>[];
  if (Array.isArray(r?.data?.orders)) return r.data.orders as Record<string, unknown>[];
  return [];
}

function mapMealsActiveRow(row: Record<string, unknown>): MealFooterActiveOrder | null {
  const orderId = String(row.orderId ?? row.id ?? '');
  if (!orderId) return null;

  const logisticsStatus =
    row.logisticsStatus != null
      ? String(row.logisticsStatus)
      : row.logistics_status != null
        ? String(row.logistics_status)
        : null;

  const rawStatus = String(row.status ?? row.trackingStatus ?? row.meal_order_status ?? '');
  let normalized = normalizeMealFooterStatus(rawStatus);
  if (!normalized && rawStatus) {
    const effective = resolveEffectiveMealDeliveryState(rawStatus, logisticsStatus);
    normalized = normalizeMealFooterStatus(effective);
  }
  if (!normalized) return null;

  return {
    orderId,
    orderNumber:
      row.orderNumber != null
        ? String(row.orderNumber)
        : row.order_number != null
          ? String(row.order_number)
          : undefined,
    vendorName:
      row.vendorName != null
        ? String(row.vendorName)
        : row.vendor_name != null
          ? String(row.vendor_name)
          : undefined,
    status: normalized,
    logisticsStatus,
    riderName: row.riderName != null ? String(row.riderName) : null,
    riderMessage: row.riderMessage != null ? String(row.riderMessage) : null,
    etaMinutes: null,
  };
}

function pickBestOrder(orders: MealFooterActiveOrder[]): MealFooterActiveOrder | null {
  if (!orders.length) return null;
  const priority: Record<string, number> = {
    on_the_way: 50,
    picked_up: 40,
    ready_for_pickup: 30,
    preparing: 20,
    confirmed: 15,
    delivered: 10,
  };
  return [...orders].sort((a, b) => (priority[b.status] ?? 0) - (priority[a.status] ?? 0))[0];
}

async function enrichWithEta(order: MealFooterActiveOrder): Promise<MealFooterActiveOrder> {
  if (order.status !== 'on_the_way' && order.status !== 'picked_up') return order;
  try {
    const res = (await apiClient.get(`/customer/tracking/${order.orderId}`)) as {
      tracking?: { eta?: number; etaToDelivery?: number };
    };
    const eta = res.tracking?.eta ?? res.tracking?.etaToDelivery ?? null;
    if (eta == null) return order;
    return { ...order, etaMinutes: typeof eta === 'number' ? eta : parseFloat(String(eta)) || null };
  } catch {
    return order;
  }
}

/**
 * Footer heartbeat: only /orders/meals/active (not meal-plan-orders history).
 * Orders / meal-plan pages keep their own on-demand meal-plan-orders fetch.
 */
export async function fetchMealFooterActiveOnly(phone: string): Promise<MealFooterActiveOrder[]> {
  const activeRes = await apiClient.get(`/customer/${phone}/orders/meals/active`);
  const candidates: MealFooterActiveOrder[] = [];
  for (const row of extractOrdersArray(activeRes)) {
    const mapped = mapMealsActiveRow(row);
    if (mapped) candidates.push(mapped);
  }
  return candidates;
}

function mealIntervalForOrder(hasLiveOrder: boolean): number {
  return hasLiveOrder ? HOME_POLL_PROFILE.mealLiveMs : HOME_POLL_PROFILE.mealIdleMs;
}

export function useMealOrderFooterToast(customerPhone: string | null | undefined) {
  const [order, setOrder] = useState<MealFooterActiveOrder | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const orderRef = useRef<MealFooterActiveOrder | null>(null);
  const failuresRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    if (!isCustomerMealPlansEnabled()) {
      setOrder(null);
      setDismissed(false);
      return null;
    }
    const phone = (customerPhone || '').replace(/\D/g, '').slice(-10);
    if (phone.length < 10) {
      setOrder(null);
      setDismissed(false);
      return null;
    }

    try {
      const mapped = await fetchMealFooterActiveOnly(phone);
      const best = pickBestOrder(mapped);
      failuresRef.current = 0;

      if (best) {
        const enriched = await enrichWithEta(best);
        setOrder(enriched);
        setDismissed(readMealFooterDismissed(enriched.orderId));
        return enriched;
      }

      setOrder(null);
      setDismissed(false);
      return null;
    } catch {
      failuresRef.current += 1;
      return orderRef.current;
    }
  }, [customerPhone]);

  const scheduleNext = useCallback(
    (hasLive: boolean) => {
      clearTimer();
      if (typeof document !== 'undefined' && isDocumentHidden()) return;
      const base = mealIntervalForOrder(hasLive);
      const delay = pollBackoffMs(base, failuresRef.current);
      timerRef.current = setTimeout(() => {
        void (async () => {
          if (isDocumentHidden()) return;
          const next = await load();
          scheduleNext(Boolean(next));
        })();
      }, delay);
    },
    [clearTimer, load]
  );

  useEffect(() => {
    let cancelled = false;
    let appListener: { remove: () => Promise<void> } | undefined;

    const runVisibleCycle = () => {
      if (cancelled || isDocumentHidden()) return;
      void (async () => {
        const next = await load();
        if (!cancelled) scheduleNext(Boolean(next));
      })();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearTimer();
      } else {
        runVisibleCycle();
      }
    };

    runVisibleCycle();
    document.addEventListener('visibilitychange', onVisibility);

    void (async () => {
      try {
        const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
        if (!cap?.isNativePlatform?.()) return;
        const { App } = await import(/* webpackIgnore: true */ '@capacitor/app');
        appListener = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) runVisibleCycle();
          else clearTimer();
        });
      } catch {
        /* non-Capacitor */
      }
    })();

    return () => {
      cancelled = true;
      clearTimer();
      document.removeEventListener('visibilitychange', onVisibility);
      appListener?.remove().catch(() => undefined);
    };
  }, [clearTimer, load, scheduleNext]);

  const dismiss = useCallback(() => {
    if (!order) return;
    setDismissed(true);
    writeMealFooterDismissed(order.orderId);
  }, [order]);

  const visible = Boolean(order) && !dismissed;

  return {
    order,
    visible,
    dismiss,
    refresh: load,
  };
}
