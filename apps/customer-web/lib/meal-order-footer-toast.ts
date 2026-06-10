import type { MealDeliveryEffective } from '@warmpawz/shared-types';

export const MEAL_FOOTER_STEPS = [
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready_for_pickup', label: 'Ready' },
  { id: 'picked_up', label: 'Picked up' },
  { id: 'on_the_way', label: 'Out for delivery' },
  { id: 'delivered', label: 'Delivered' },
] as const;

/** Footer toast from vendor preparing through delivery (not pending-only). */
export const MEAL_FOOTER_VISIBLE_STATES: MealDeliveryEffective[] = [
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'on_the_way',
  'delivered',
];

export type MealFooterActiveOrder = {
  orderId: string;
  orderNumber?: string;
  vendorName?: string;
  status: MealDeliveryEffective;
  logisticsStatus?: string | null;
  riderName?: string | null;
  riderMessage?: string | null;
  etaMinutes?: number | null;
};

export function mealFooterStepIndex(status: MealDeliveryEffective): number {
  if (status === 'confirmed') return -1;
  const idx = MEAL_FOOTER_STEPS.findIndex((s) => s.id === status);
  return idx >= 0 ? idx : 0;
}

export function normalizeMealFooterStatus(raw: string): MealDeliveryEffective | null {
  const normalized = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (normalized === 'accepted') return 'confirmed';
  if (normalized === 'out_for_delivery') return 'on_the_way';
  if ((MEAL_FOOTER_VISIBLE_STATES as string[]).includes(normalized)) {
    return normalized as MealDeliveryEffective;
  }
  return null;
}

export function isMealFooterVisibleState(status: string): status is MealDeliveryEffective {
  return normalizeMealFooterStatus(status) != null;
}

/** Dismiss is per order — stays hidden only after customer taps X for that order. */
export function mealFooterDismissKey(orderId: string): string {
  return `warmpawz_meal_footer_dismiss_order:${orderId}`;
}

export function readMealFooterDismissed(orderId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(mealFooterDismissKey(orderId)) === '1') return true;
    // Legacy per-status keys (pre-fix): treat as not dismissed so active orders reappear.
    return false;
  } catch {
    return false;
  }
}

export function writeMealFooterDismissed(orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(mealFooterDismissKey(orderId), '1');
  } catch {
    /* ignore */
  }
}

export function formatMealFooterOrderId(orderNumber?: string, orderId?: string): string {
  const raw = (orderNumber || '').trim();
  if (raw) return raw.startsWith('#') ? raw : `#${raw}`;
  const id = (orderId || '').replace(/-/g, '');
  const tail = id.length >= 8 ? id.slice(-10) : id || '—';
  return `#${tail}`;
}

export function mealFooterHeadline(status: MealDeliveryEffective): string {
  switch (status) {
    case 'confirmed':
      return 'Order confirmed';
    case 'preparing':
      return 'Being prepared';
    case 'ready_for_pickup':
      return 'Ready for pickup';
    case 'picked_up':
      return 'Picked up';
    case 'on_the_way':
      return 'Out for delivery';
    case 'delivered':
      return 'Delivered!';
    default:
      return 'Order update';
  }
}

export function mealFooterSubline(order: MealFooterActiveOrder): string {
  const oid = formatMealFooterOrderId(order.orderNumber, order.orderId);
  switch (order.status) {
    case 'confirmed':
      return `Your meal order ${oid} is confirmed — kitchen will start soon`;
    case 'preparing':
      return `Your meal order ${oid} is being prepared`;
    case 'ready_for_pickup':
      return `Your meal order ${oid} is ready — rider will collect soon`;
    case 'picked_up':
      return order.riderName
        ? `Rider ${order.riderName} picked up ${oid}`
        : `Your meal order ${oid} has been picked up`;
    case 'on_the_way':
      if (order.riderName && order.etaMinutes != null && order.etaMinutes > 0) {
        return `Rider ${order.riderName} is heading to you · ETA ~${Math.round(order.etaMinutes)} min`;
      }
      if (order.riderName) return `Rider ${order.riderName} is heading to you`;
      return order.riderMessage || `Your meal order ${oid} is on the way`;
    case 'delivered':
      return `Your meal order ${oid} was delivered`;
    default:
      return `Track meal order ${oid}`;
  }
}
