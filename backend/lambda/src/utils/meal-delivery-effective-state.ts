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

export function splitMealStatusSegments(raw: string | null | undefined): string[] {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (!s) return [];
  return s
    .split('|')
    .map((p) =>
      p
        .trim()
        .replace(/-/g, '_')
        .replace(/\s+/g, '_'),
    )
    .filter(Boolean);
}

export function normalizeMealDeliveryToken(raw: string | null | undefined): string {
  const parts = splitMealStatusSegments(raw);
  if (parts.length <= 1) {
    return parts[0] ?? '';
  }
  return parts.join('_');
}

export function resolveEffectiveMealDeliveryState(
  orderStatus: string | null | undefined,
  logisticsStatus: string | null | undefined,
): MealDeliveryEffective {
  const orderSegs = splitMealStatusSegments(orderStatus);
  const logSegs = splitMealStatusSegments(logisticsStatus);
  const oJoined = orderSegs.join('_');
  const lJoined = logSegs.join('_');

  const hasCancelled = [...orderSegs, ...logSegs].some((s) => s === 'cancelled');
  if (hasCancelled) return 'cancelled';

  const hasFailed = [...orderSegs, ...logSegs].some((s) => s === 'failed');
  if (hasFailed) return 'failed';

  const hasDeliveredSegment = [...orderSegs, ...logSegs].some((s) =>
    ['delivered', 'complete', 'completed'].includes(s),
  );
  if (hasDeliveredSegment) return 'delivered';

  if (oJoined === 'fulfilled' || (orderSegs.length === 1 && orderSegs[0] === 'fulfilled')) {
    return 'delivered';
  }

  if (logSegs.some((s) => s === 'fulfilled') && logSegs.some((s) => s === 'delivered')) {
    return 'delivered';
  }
  if (lJoined === 'fulfilled' && !logSegs.includes('ofd') && !logSegs.includes('picked_up')) {
    if (logSegs.length === 1) return 'delivered';
  }

  const tierOf = (token: string): number => {
    if (!token) return -1;
    if (['on_the_way', 'nearby', 'out_for_delivery', 'started_for_delivery', 'ofd'].includes(token)) return 50;
    if (token === 'picked_up') return 44;
    if (['at_pickup'].includes(token)) return 42;
    if (['heading_to_pickup', 'assigned'].includes(token)) return 22;
    if (['pending_assignment'].includes(token)) return 16;
    if (['ready_for_pickup', 'ready', 'dispatched'].includes(token)) return 30;
    if (token === 'preparing') return 20;
    if (['confirmed', 'accepted'].includes(token)) return 10;
    if (['pending', 'payment_pending', 'payment_processing'].includes(token)) return 5;
    return 0;
  };

  const orderTier = Math.max(-1, ...orderSegs.map((s) => tierOf(s)));
  const logisticsTier = Math.max(-1, ...logSegs.map((s) => tierOf(s)));
  let t = Math.max(orderTier, logisticsTier);

  if (orderTier < 20 && logisticsTier >= 16 && logisticsTier < 30) {
    t = Math.max(orderTier, Math.min(logisticsTier, 18));
  }

  if (t >= 50) return 'on_the_way';
  if (t >= 38) return 'picked_up';
  if (t >= 30) return 'ready_for_pickup';
  return mapBelowReadyTier(t, oJoined, lJoined);
}

function mapBelowReadyTier(tier: number, _o: string, _l: string): MealDeliveryEffective {
  if (tier >= 20) return 'preparing';
  if (tier >= 10) return 'confirmed';
  if (tier >= 5) return 'pending';
  return 'pending';
}

export function isTerminalMealDeliveryState(status: MealDeliveryEffective): boolean {
  return status === 'delivered' || status === 'cancelled' || status === 'failed';
}
