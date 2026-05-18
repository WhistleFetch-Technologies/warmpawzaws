/**
 * Single precedence rules for meal hyperlocal delivery across customer + vendor surfaces.
 * Terminal meal order states must never be overridden by stale delivery_tracking rows.
 */

export type MealDeliveryEffective =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export function normalizeMealDeliveryToken(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
}

/**
 * Merge meal_orders.status with delivery_tracking.status using fixed priority:
 * DELIVERED > FAILED/CANCELLED > OUT_FOR_DELIVERY > PICKED_UP > READY_FOR_PICKUP > PREPARING > CONFIRMED.
 *
 * Treat `fulfilled` (some partners) as delivered. Once delivered/cancelled/failed, logistics cannot regress UI.
 */
export function resolveEffectiveMealDeliveryState(
  orderStatus: string | null | undefined,
  logisticsStatus: string | null | undefined,
): MealDeliveryEffective {
  const o = normalizeMealDeliveryToken(orderStatus);
  const l = normalizeMealDeliveryToken(logisticsStatus);

  if (o === 'delivered' || l === 'delivered' || o === 'fulfilled') {
    return 'delivered';
  }
  if (o === 'cancelled' || l === 'cancelled') {
    return 'cancelled';
  }
  if (o === 'failed' || l === 'failed') {
    return 'failed';
  }

  const tierOf = (token: string): number => {
    if (!token) return -1;
    if (['on_the_way', 'nearby', 'out_for_delivery', 'started_for_delivery'].includes(token)) return 50;
    if (token === 'picked_up') return 40;
    if (['at_pickup'].includes(token)) return 38;
    if (['heading_to_pickup', 'assigned'].includes(token)) return 35;
    if (['pending_assignment'].includes(token)) return 33;
    if (['ready_for_pickup', 'ready', 'dispatched'].includes(token)) return 30;
    if (token === 'preparing') return 20;
    if (['confirmed', 'accepted'].includes(token)) return 10;
    if (['pending', 'payment_pending', 'payment_processing'].includes(token)) return 5;
    return 0;
  };

  const t = Math.max(tierOf(o), tierOf(l));
  if (t >= 50) return 'on_the_way';
  if (t >= 40) return 'picked_up';
  if (t >= 30) return 'ready_for_pickup';
  return mapBelowReadyTier(t, o, l);
}

function mapBelowReadyTier(tier: number, o: string, l: string): MealDeliveryEffective {
  if (tier >= 20) return 'preparing';
  if (tier >= 10) return 'confirmed';
  if (tier >= 5) return 'pending';
  if (o || l) return 'pending';
  return 'pending';
}

export function formatVendorMealDeliveryBadge(status: MealDeliveryEffective): string {
  switch (status) {
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Failed';
    case 'on_the_way':
      return 'Out for delivery';
    case 'picked_up':
      return 'Picked up';
    case 'ready_for_pickup':
      return 'Ready for pickup';
    case 'preparing':
      return 'Preparing';
    case 'confirmed':
      return 'Confirmed';
    case 'pending':
    default:
      return 'Pending';
  }
}

export function isTerminalMealDeliveryState(status: MealDeliveryEffective): boolean {
  return status === 'delivered' || status === 'cancelled' || status === 'failed';
}
