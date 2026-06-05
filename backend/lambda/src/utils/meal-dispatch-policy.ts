/** Which vendor status transition triggers Pidge create-order (default: ready_for_pickup). */
export type MealPidgeDispatchOn = 'preparing' | 'ready_for_pickup';

export function mealPidgeDispatchOn(): MealPidgeDispatchOn {
  const raw = String(process.env.MEAL_PIDGE_DISPATCH_ON || 'ready_for_pickup')
    .trim()
    .toLowerCase();
  return raw === 'preparing' ? 'preparing' : 'ready_for_pickup';
}

export function mealDispatchFailureUserMessage(
  trigger: MealPidgeDispatchOn = mealPidgeDispatchOn(),
): string {
  if (trigger === 'ready_for_pickup') {
    return 'Could not schedule delivery partner. Fix the issue, then try Ready for pickup again.';
  }
  return 'Could not schedule delivery partner. Fix the issue, then try Start preparing again.';
}

/** True when strict mode should run dispatch before persisting this status. */
export function isMealLogisticsDispatchStatus(status: string): boolean {
  const norm = String(status || '').trim().toLowerCase();
  return norm === mealPidgeDispatchOn();
}

/** Legacy: when dispatch runs on preparing, ready_for_pickup requires an existing Pidge link. */
export function shouldRequirePidgeBeforeReadyForPickup(): boolean {
  return mealPidgeDispatchOn() === 'preparing';
}
