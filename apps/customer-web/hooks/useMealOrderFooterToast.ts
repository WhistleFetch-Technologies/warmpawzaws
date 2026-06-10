'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { isCustomerMealPlansEnabled } from '@/lib/customer-meal-plans-flag';
import { resolveEffectiveMealDeliveryState } from '@warmpawz/shared-types';
import {
  normalizeMealFooterStatus,
  readMealFooterDismissed,
  writeMealFooterDismissed,
  type MealFooterActiveOrder,
} from '@/lib/meal-order-footer-toast';

const POLL_MS = 5_000;

function extractActiveMealOrders(res: unknown): Record<string, unknown>[] {
  const r = res as { orders?: unknown[]; data?: { orders?: unknown[] } };
  if (Array.isArray(r?.orders)) return r.orders as Record<string, unknown>[];
  if (Array.isArray(r?.data?.orders)) return r.data.orders as Record<string, unknown>[];
  return [];
}

function mapActiveRow(row: Record<string, unknown>): MealFooterActiveOrder | null {
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
    orderNumber: row.orderNumber != null ? String(row.orderNumber) : undefined,
    vendorName: row.vendorName != null ? String(row.vendorName) : undefined,
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
      const res = await apiClient.get(`/customer/${phone}/orders/meals/active`);
      const mapped = extractActiveMealOrders(res)
        .map(mapActiveRow)
        .filter((o): o is MealFooterActiveOrder => Boolean(o));
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
      /* non-fatal — keep last known order visible until explicit dismiss */
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
