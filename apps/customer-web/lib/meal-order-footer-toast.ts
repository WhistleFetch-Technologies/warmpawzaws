import type { MealDeliveryEffective } from '@warmpawz/shared-types';

export const MEAL_FOOTER_STEPS = [
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready_for_pickup', label: 'Ready' },
  { id: 'picked_up', label: 'Picked up' },
  { id: 'on_the_way', label: 'Out for delivery' },
  { id: 'delivered', label: 'Delivered' },
] as const;

/** Footer toast starts when vendor moves to preparing (not confirmed/pending). */
export const MEAL_FOOTER_VISIBLE_STATES: MealDeliveryEffective[] = [
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
  const idx = MEAL_FOOTER_STEPS.findIndex((s) => s.id === status);
  return idx >= 0 ? idx : 0;
}

export function isMealFooterVisibleState(status: string): status is MealDeliveryEffective {
  return (MEAL_FOOTER_VISIBLE_STATES as string[]).includes(status);
}

export function mealFooterDismissKey(orderId: string, status: string): string {
  return `warmpawz_meal_footer_dismiss:${orderId}:${status}`;
}

export function readMealFooterDismissed(orderId: string, status: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(mealFooterDismissKey(orderId, status)) === '1';
  } catch {
    return false;
  }
}

export function writeMealFooterDismissed(orderId: string, status: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(mealFooterDismissKey(orderId, status), '1');
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
