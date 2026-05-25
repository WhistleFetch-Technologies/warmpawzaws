/** Customer-facing helpers for vendor meal kitchen pause (from API fields). */

export type MealKitchenAvailabilityFields = {
  acceptingMealOrders?: boolean;
  accepting_meal_orders?: boolean;
  kitchenClosedMessage?: string | null;
  kitchen_closed_message?: string | null;
  kitchenAvailability?: {
    acceptingOrders?: boolean;
    message?: string | null;
  };
};

export function isMealKitchenClosed(row: MealKitchenAvailabilityFields | null | undefined): boolean {
  if (!row) return false;
  if (row.kitchenAvailability && row.kitchenAvailability.acceptingOrders === false) return true;
  if (row.acceptingMealOrders === false || row.accepting_meal_orders === false) return true;
  return false;
}

export function mealKitchenClosedMessage(
  row: MealKitchenAvailabilityFields | null | undefined,
): string {
  if (!row) return "This kitchen isn't taking new orders right now.";
  const msg =
    row.kitchenClosedMessage ??
    row.kitchen_closed_message ??
    row.kitchenAvailability?.message ??
    null;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  return "This kitchen isn't taking new orders right now.";
}
