/**
 * Single precedence rules for meal hyperlocal delivery across customer + vendor surfaces.
 * Terminal meal order states must never be overridden by stale delivery_tracking rows.
 *
 * Pidge sandbox / dummy webhooks may send compound strings such as `fulfilled|ofd` — we split on `|`
 * and derive the furthest meaningful logistics stage without treating early rider pool states
 * (`pending_assignment`, …) as "ready for pickup".
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

/** Split Pidge / sandbox compound statuses: `fulfilled|ofd`, `stg|picked_up`, etc. */
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
  /** For single-token APIs, join with _ so legacy equality on full string still works where needed */
  return parts.join('_');
}

/**
 * Merge meal_orders.status with delivery_tracking.status using fixed priority.
 * DELIVERED > FAILED/CANCELLED > OUT_FOR_DELIVERY > PICKED_UP > READY_FOR_PICKUP > PREPARING > CONFIRMED.
 *
 * Treat `fulfilled` on the **order** row as delivered (legacy). For logistics, require an explicit
 * `delivered` segment in compound strings so `fulfilled|ofd` does not jump to delivered.
 */
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

  /** Whole-order legacy: meal_orders.status === fulfilled */
  if (oJoined === 'fulfilled' || (orderSegs.length === 1 && orderSegs[0] === 'fulfilled')) {
    return 'delivered';
  }

  /** Logistics-only terminal (some pipelines write fulfilled on tracking when complete) */
  if (logSegs.some((s) => s === 'fulfilled') && logSegs.some((s) => s === 'delivered')) {
    return 'delivered';
  }
  if (lJoined === 'fulfilled' && !logSegs.includes('ofd') && !logSegs.includes('picked_up')) {
    /** lone fulfilled on tracking — treat as delivered */
    if (logSegs.length === 1) return 'delivered';
  }

  const tierOf = (token: string): number => {
    if (!token) return -1;
    if (['on_the_way', 'nearby', 'out_for_delivery', 'started_for_delivery', 'ofd'].includes(token)) return 50;
    if (token === 'picked_up') return 44;
    if (['at_pickup'].includes(token)) return 42;
    /** Rider en route to restaurant — must not collapse to "ready for pickup" */
    if (['heading_to_pickup', 'assigned'].includes(token)) return 22;
    if (['pending_assignment'].includes(token)) return 16;
    /** Vendor handed off / partner labels — kitchen should already be at least ready */
    if (['ready_for_pickup', 'ready', 'dispatched'].includes(token)) return 30;
    if (token === 'preparing') return 20;
    if (['confirmed', 'accepted'].includes(token)) return 10;
    if (['pending', 'payment_pending', 'payment_processing'].includes(token)) return 5;
    return 0;
  };

  const orderTier = Math.max(-1, ...orderSegs.map((s) => tierOf(s)));
  const logisticsTier = Math.max(-1, ...logSegs.map((s) => tierOf(s)));
  let t = Math.max(orderTier, logisticsTier);

  /**
   * Early rider pool / assignment must not outrank kitchen: cap logistics-driven tier to orderTier
   * until the vendor row has at least reached "preparing" (20), except when logistics already proves
   * handoff (picked_up, ofd, …).
   */
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

/** Rider card / live enrichment only during active delivery phases (Pidge + internal). */
export function shouldShowDeliveryRider(logisticsStatus: string | null | undefined): boolean {
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

/** Customer-facing delivery headline from raw logistics status (not effective kitchen state). */
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
