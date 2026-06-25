/**
 * Meal order ∪ delivery_tracking precedence (Lambda bundle copy — keep in sync with
 * packages/shared-types/src/meal-delivery-status.ts).
 */

export type MealDeliveryEffective =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'reassign_pending'
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
  options?: {
    reassignPending?: boolean;
    cancelledBy?: string | null;
    cancelledAt?: string | null;
  },
): MealDeliveryEffective {
  if (options?.reassignPending && String(orderStatus ?? '').trim().toLowerCase() === 'ready_for_pickup') {
    return 'reassign_pending';
  }

  const orderSegs = splitMealStatusSegments(orderStatus);
  const logSegs = splitMealStatusSegments(logisticsStatus);
  const oJoined = orderSegs.join('_');
  const lJoined = logSegs.join('_');

  const hasCancelledBy =
    options?.cancelledBy != null && String(options.cancelledBy).trim() !== '';
  const hasCancelledAt =
    options?.cancelledAt != null && String(options.cancelledAt).trim() !== '';
  const hasCancelled = hasCancelledBy || hasCancelledAt || [...orderSegs, ...logSegs].some((s) => s === 'cancelled');
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

export function parseDeliveryTrackingReassignPending(metadata: unknown): boolean {
  if (metadata == null) return false;
  let obj: Record<string, unknown>;
  if (typeof metadata === 'string') {
    try {
      obj = JSON.parse(metadata) as Record<string, unknown>;
    } catch {
      return false;
    }
  } else if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    obj = metadata as Record<string, unknown>;
  } else {
    return false;
  }
  return obj.reassign_pending === true;
}

export function isTerminalMealDeliveryState(status: MealDeliveryEffective): boolean {
  return status === 'delivered' || status === 'cancelled' || status === 'failed';
}

/** Rider footer bar on customer home — active Pidge delivery phases only (not kitchen). */
export function shouldShowMealRiderFooterBar(
  logisticsStatus: string | null | undefined,
  options?: { reassignPending?: boolean },
): boolean {
  if (options?.reassignPending) return true;
  const segs = splitMealStatusSegments(logisticsStatus);
  const active = new Set([
    'heading_to_pickup',
    'at_pickup',
    'picked_up',
    'on_the_way',
    'nearby',
    'out_for_delivery',
    'ofd',
  ]);
  return segs.some((s) => active.has(s));
}

export function shouldShowDeliveryRider(
  logisticsStatus: string | null | undefined,
  options?: { reassignPending?: boolean },
): boolean {
  if (options?.reassignPending) return false;
  const segs = splitMealStatusSegments(logisticsStatus);
  const active = new Set([
    'heading_to_pickup',
    'at_pickup',
    'picked_up',
    'on_the_way',
    'nearby',
  ]);
  return segs.some((s) => active.has(s));
}

export function mealRiderDeliveryMessage(logisticsStatus: string | null | undefined): string | null {
  const segs = splitMealStatusSegments(logisticsStatus);
  if (segs.includes('nearby')) return 'Arriving soon';
  if (segs.includes('on_the_way') || segs.includes('ofd') || segs.includes('out_for_delivery')) {
    return 'Out for delivery';
  }
  if (segs.includes('picked_up')) return 'Your order has been picked up';
  if (segs.includes('heading_to_pickup')) return 'Delivery partner assigned';
  if (segs.includes('at_pickup')) return 'Rider at pickup';
  return null;
}
