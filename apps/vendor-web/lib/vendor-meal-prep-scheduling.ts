import {
  buildVendorPrepScheduling,
  MEAL_VENDOR_EARLY_PREP_WARNING,
  type VendorPrepSchedulingResult,
} from '@warmpawz/shared-types';

export { MEAL_VENDOR_EARLY_PREP_WARNING };

const DEFAULT_PREP_MINUTES = 30;

export function resolveVendorMealPrepMinutes(order: Record<string, unknown>): number {
  const fromOrder = Number(order.prep_minutes);
  if (Number.isFinite(fromOrder) && fromOrder > 0) return Math.floor(fromOrder);
  const fromPlan = Number(order.prep_time_minutes ?? order.plan_prep_time_minutes);
  if (Number.isFinite(fromPlan) && fromPlan > 0) return Math.floor(fromPlan);
  return DEFAULT_PREP_MINUTES;
}

export function vendorMealPrepSchedulingFromOrder(
  order: Record<string, unknown>,
  nowMs?: number,
): VendorPrepSchedulingResult {
  const slot =
    order.scheduled_delivery_slot ??
    order.delivery_time_slot ??
    order.delivery_time;
  const date = order.scheduled_delivery_date ?? order.delivery_date;
  return buildVendorPrepScheduling({
    scheduledDeliveryDate: date,
    scheduledDeliverySlot: slot,
    prepMinutes: resolveVendorMealPrepMinutes(order),
    nowMs,
  });
}

export function confirmVendorEarlyMealPrep(scheduling: VendorPrepSchedulingResult): boolean {
  if (!scheduling.isEarlyPrep) return true;
  return window.confirm(MEAL_VENDOR_EARLY_PREP_WARNING);
}
