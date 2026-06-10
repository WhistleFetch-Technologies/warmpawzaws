'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { isCustomerMealPlansEnabled } from '@/lib/customer-meal-plans-flag';
import { isMealOrderAwaitingPayment, isMealPaymentHoldExpired } from '@/lib/payment-hold-ui';
import { resolveEffectiveMealDeliveryState } from '@warmpawz/shared-types';
import {
  normalizeMealFooterStatus,
  readMealFooterDismissed,
  writeMealFooterDismissed,
  type MealFooterActiveOrder,
} from '@/lib/meal-order-footer-toast';

const POLL_MS = 5_000;

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

/** Same source as Meal Plan Orders page — proven to return preparing rows. */
function mapMealPlanOrdersRow(row: Record<string, unknown>): MealFooterActiveOrder | null {
  const orderId = String(row.id ?? row.orderId ?? '');
  if (!orderId) return null;

  const rawStatus = String(row.status ?? '').trim();
  const lower = rawStatus.toLowerCase();
  if (['delivered', 'cancelled', 'refunded'].includes(lower)) return null;

  const paymentCtx = {
    status: rawStatus,
    paymentStatus: (row.payment_status ?? row.paymentStatus) as string | undefined,
    paymentHoldExpiresAt: (row.payment_hold_expires_at ?? row.paymentHoldExpiresAt) as string | null | undefined,
    createdAt: row.created_at as string | undefined,
  };
  if (isMealPaymentHoldExpired(paymentCtx)) return null;
  if (isMealOrderAwaitingPayment(paymentCtx)) return null;

  const normalized = normalizeMealFooterStatus(rawStatus);
  if (!normalized) return null;

  return {
    orderId,
    orderNumber: row.order_number != null ? String(row.order_number) : undefined,
    vendorName:
      row.vendor_name != null
        ? String(row.vendor_name)
        : row.vendorName != null
          ? String(row.vendorName)
          : undefined,
    status: normalized,
    logisticsStatus: null,
    riderName: null,
    riderMessage: null,
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

async function fetchMealFooterCandidates(phone: string): Promise<MealFooterActiveOrder[]> {
  const candidates: MealFooterActiveOrder[] = [];

  // Primary: same API as /orders/meal-plans (user sees PREPARING here).
  try {
    const q = new URLSearchParams();
    q.set('phone', phone);
    const customerId = getResolvedCustomerId();
    if (customerId) q.set('customerId', customerId);
    const mealPlanRes = await apiClient.get(`/customer/meal-plan-orders?${q.toString()}`);
    for (const row of extractOrdersArray(mealPlanRes)) {
      const mapped = mapMealPlanOrdersRow(row);
      if (mapped) candidates.push(mapped);
    }
  } catch {
    /* try fallback */
  }

  // Secondary: logistics-enriched active list (when SQL succeeds).
  try {
    const activeRes = await apiClient.get(`/customer/${phone}/orders/meals/active`);
    for (const row of extractOrdersArray(activeRes)) {
      const mapped = mapMealsActiveRow(row);
      if (mapped) candidates.push(mapped);
    }
  } catch {
    /* meal-plan-orders may be enough */
  }

  const byId = new Map<string, MealFooterActiveOrder>();
  for (const c of candidates) {
    const prev = byId.get(c.orderId);
    if (!prev) {
      byId.set(c.orderId, c);
      continue;
    }
    const best = pickBestOrder([prev, c]);
    if (best) byId.set(c.orderId, best);
  }

  return [...byId.values()];
}

export function useMealOrderFooterToast(customerPhone: string | null | undefined) {
  const [order, setOrder] = useState<MealFooterActiveOrder | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    if (!isCustomerMealPlansEnabled()) {
      setOrder(null);
      setDismissed(false);
      return;
    }
    const phone = (customerPhone || '').replace(/\D/g, '').slice(-10);
    if (phone.length < 10) {
      setOrder(null);
      setDismissed(false);
      return;
    }

    try {
      const mapped = await fetchMealFooterCandidates(phone);
      const best = pickBestOrder(mapped);

      if (best) {
        const enriched = await enrichWithEta(best);
        setOrder(enriched);
        setDismissed(readMealFooterDismissed(enriched.orderId));
        return;
      }

      setOrder(null);
      setDismissed(false);
    } catch {
      /* keep last order on transient errors */
    }
  }, [customerPhone]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

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
