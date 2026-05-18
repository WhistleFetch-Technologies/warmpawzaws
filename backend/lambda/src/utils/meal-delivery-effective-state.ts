/**
 * Meal order ∪ delivery_tracking precedence (Lambda bundle copy — keep in sync with
 * packages/shared-types/src/meal-delivery-status.ts).
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

export function isTerminalMealDeliveryState(status: MealDeliveryEffective): boolean {
  return status === 'delivered' || status === 'cancelled' || status === 'failed';
}
