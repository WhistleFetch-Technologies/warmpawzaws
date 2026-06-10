'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { isCustomerMealPlansEnabled } from '@/lib/customer-meal-plans-flag';
import { resolveEffectiveMealDeliveryState } from '@warmpawz/shared-types';
import {
  isMealFooterVisibleState,
  readMealFooterDismissed,
  writeMealFooterDismissed,
  type MealFooterActiveOrder,
} from '@/lib/meal-order-footer-toast';

const POLL_MS = 10_000;
const DELIVERED_FLASH_MS = 10_000;

function mapActiveRow(row: Record<string, unknown>): MealFooterActiveOrder | null {
  const orderId = String(row.orderId ?? row.id ?? '');
  if (!orderId) return null;
  const status = String(row.status ?? row.trackingStatus ?? '');
  if (!isMealFooterVisibleState(status)) return null;
  return {
    orderId,
    orderNumber: row.orderNumber != null ? String(row.orderNumber) : undefined,
    vendorName: row.vendorName != null ? String(row.vendorName) : undefined,
    status,
    logisticsStatus:
      row.logisticsStatus != null
        ? String(row.logisticsStatus)
        : row.logistics_status != null
          ? String(row.logistics_status)
          : null,
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
  const lastTrackedIdRef = useRef<string | null>(null);
  const deliveredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDeliveredTimer = useCallback(() => {
    if (deliveredTimerRef.current) {
      clearTimeout(deliveredTimerRef.current);
      deliveredTimerRef.current = null;
    }
  }, []);

  const showDeliveredFlash = useCallback(
    (base: MealFooterActiveOrder) => {
      clearDeliveredTimer();
      const delivered: MealFooterActiveOrder = { ...base, status: 'delivered' };
      setOrder(delivered);
      setDismissed(false);
      deliveredTimerRef.current = setTimeout(() => {
        setOrder(null);
        deliveredTimerRef.current = null;
      }, DELIVERED_FLASH_MS);
    },
    [clearDeliveredTimer],
  );

  const load = useCallback(async () => {
    if (!isCustomerMealPlansEnabled()) {
      setOrder(null);
      return;
    }
    const phone = (customerPhone || '').replace(/\D/g, '').slice(-10);
    if (phone.length < 10) {
      setOrder(null);
      return;
    }

    try {
      const res = (await apiClient.get(`/customer/${phone}/orders/meals/active`)) as {
        orders?: Record<string, unknown>[];
      };
      const mapped = (res.orders || [])
        .map(mapActiveRow)
        .filter((o): o is MealFooterActiveOrder => Boolean(o));
      const best = pickBestOrder(mapped);

      if (best) {
        lastTrackedIdRef.current = best.orderId;
        clearDeliveredTimer();
        if (readMealFooterDismissed(best.orderId, best.status)) {
          setOrder(best);
          setDismissed(true);
        } else {
          const enriched = await enrichWithEta(best);
          setOrder(enriched);
          setDismissed(false);
        }
        return;
      }

      const prevId = lastTrackedIdRef.current;
      if (prevId && !deliveredTimerRef.current) {
        try {
          const tr = (await apiClient.get(`/customer/tracking/${prevId}`)) as {
            order?: { status?: string };
            tracking?: { status?: string };
          };
          const moStatus = tr.order?.status;
          const dtStatus = tr.tracking?.status;
          const eff = resolveEffectiveMealDeliveryState(moStatus, dtStatus);
          if (eff === 'delivered') {
            showDeliveredFlash({
              orderId: prevId,
              status: 'delivered',
              orderNumber: undefined,
            });
            lastTrackedIdRef.current = null;
            return;
          }
        } catch {
          /* ignore */
        }
        lastTrackedIdRef.current = null;
      }

      if (!deliveredTimerRef.current) {
        setOrder(null);
        setDismissed(false);
      }
    } catch {
      /* non-fatal */
    }
  }, [customerPhone, clearDeliveredTimer, showDeliveredFlash]);

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
      clearDeliveredTimer();
    };
  }, [load, clearDeliveredTimer]);

  const dismiss = useCallback(() => {
    if (!order) return;
    setDismissed(true);
    writeMealFooterDismissed(order.orderId, order.status);
  }, [order]);

  const visible = Boolean(order) && !dismissed;

  return {
    order,
    visible,
    dismiss,
    refresh: load,
  };
}
