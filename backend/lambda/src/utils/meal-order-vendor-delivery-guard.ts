/**
 * Vendor-initiated meal delivery transitions must stay disabled when Pidge owns the ride.
 *
 * Rider/completion updates come from Java delivery-service (POST /webhooks/pidge → DB), not from Lambda.
 */

/** Rider / completion steps — Java applies these from Pidge webhooks. Kitchen may still mark `ready_for_pickup`. */
export const VENDOR_BLOCKED_PIDGE_MEAL_STATUSES = ['picked_up', 'on_the_way', 'delivered'] as const;

export function isPidgeMealLogistics(logisticsType: unknown): boolean {
  return String(logisticsType || '').trim().toLowerCase() === 'pidge';
}

/** Vendor may still mark kitchen ready; blocked statuses are rider / completion steps driven by webhooks. */
export function vendorBlockedMealStatusForPidge(requestedStatus: string): boolean {
  const s = String(requestedStatus || '').trim().toLowerCase();
  return (VENDOR_BLOCKED_PIDGE_MEAL_STATUSES as readonly string[]).includes(s);
}
