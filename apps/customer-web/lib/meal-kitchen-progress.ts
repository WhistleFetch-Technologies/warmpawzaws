import {
  resolveEffectiveMealDeliveryState,
  splitMealStatusSegments,
  mealRiderDeliveryMessage,
  mealReassignMessage,
  type MealDeliveryEffective,
} from '@warmpawz/shared-types';

export const MEAL_TIMELINE_STEP_COUNT = 6;

export type MealKitchenProgressOptions = {
  reassignPending?: boolean;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
};

function resolveKitchenProgressOptions(
  options?: boolean | MealKitchenProgressOptions,
): MealKitchenProgressOptions {
  if (typeof options === 'boolean') {
    return { reassignPending: options };
  }
  return options ?? {};
}

function kitchenProgressForTerminalCancel(
  orderStatus: string,
  options: MealKitchenProgressOptions,
): { filled: number; current: number | null } {
  const kitchenEff = resolveEffectiveMealDeliveryState(orderStatus, null, {
    reassignPending: options.reassignPending,
  });
  const progress: Record<
    Exclude<MealDeliveryEffective, 'delivered' | 'cancelled' | 'failed'>,
    { filled: number; current: number | null }
  > = {
    pending: { filled: 0, current: 0 },
    confirmed: { filled: 0, current: 0 },
    preparing: { filled: 1, current: 1 },
    ready_for_pickup: { filled: 2, current: 2 },
    reassign_pending: { filled: 2, current: 2 },
    picked_up: { filled: 3, current: 3 },
    on_the_way: { filled: 4, current: 4 },
  };
  const p =
    kitchenEff === 'cancelled' || kitchenEff === 'failed' || kitchenEff === 'delivered'
      ? { filled: 0, current: 0 }
      : (progress[kitchenEff] ?? { filled: 0, current: 0 });
  if ((p.current ?? 0) >= 3) {
    return { filled: 2, current: 2 };
  }
  return p;
}

/** Six-step meal + hyperlocal timeline (order status + optional delivery_tracking). */
export function mealKitchenProgress(
  orderStatus: string,
  logisticsStatus?: string | null,
  options?: boolean | MealKitchenProgressOptions,
): { filled: number; current: number | null } {
  const opts = resolveKitchenProgressOptions(options);
  const eff = resolveEffectiveMealDeliveryState(orderStatus, logisticsStatus, opts);
  if (eff === 'cancelled') {
    return kitchenProgressForTerminalCancel(orderStatus, opts);
  }
  if (eff === 'failed') {
    if (opts.cancelledBy) {
      return kitchenProgressForTerminalCancel(orderStatus, opts);
    }
    return { filled: 2, current: 2 };
  }
  if (eff === 'reassign_pending') return { filled: 2, current: 2 };
  if (eff === 'delivered') {
    return { filled: MEAL_TIMELINE_STEP_COUNT, current: null };
  }

  const progress: Record<
    Exclude<MealDeliveryEffective, 'delivered' | 'cancelled' | 'failed'>,
    { filled: number; current: number | null }
  > = {
    pending: { filled: 0, current: 0 },
    confirmed: { filled: 0, current: 0 },
    preparing: { filled: 1, current: 1 },
    ready_for_pickup: { filled: 2, current: 2 },
    reassign_pending: { filled: 2, current: 2 },
    picked_up: { filled: 3, current: 3 },
    on_the_way: { filled: 4, current: 4 },
  };

  return progress[eff] ?? { filled: 0, current: 0 };
}

export function mealHeroHeadline(
  orderStatus: string,
  logisticsStatus: string | null | undefined,
  options?: boolean | MealKitchenProgressOptions,
): string {
  const opts = resolveKitchenProgressOptions(options);
  const eff = resolveEffectiveMealDeliveryState(orderStatus, logisticsStatus, opts);
  if (eff === 'delivered') return 'Delivered!';
  if (eff === 'cancelled') return 'Order cancelled';
  if (eff === 'failed') {
    return opts.cancelledBy ? 'Order cancelled' : 'Delivery issue — support will assist';
  }
  if (eff === 'reassign_pending') return mealReassignMessage();

  const riderMsg = mealRiderDeliveryMessage(logisticsStatus);
  if (riderMsg) return riderMsg;

  const segs = splitMealStatusSegments(logisticsStatus);
  if (segs.includes('pending_assignment')) return 'Finding delivery partner…';
  if (segs.includes('assigned')) return 'Rider heading to pickup…';

  switch (eff) {
    case 'pending':
      return 'Awaiting confirmation…';
    case 'confirmed':
      return 'Processing…';
    case 'preparing':
      return 'Being prepared…';
    case 'ready_for_pickup':
      return 'Ready for pickup';
    case 'picked_up':
      return 'Picked up';
    case 'on_the_way':
      return 'Out for delivery…';
    default:
      return 'Processing…';
  }
}
