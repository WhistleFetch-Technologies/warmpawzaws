/**
 * Guards and FK cleanup for customer pet deletion (bookings + meal plans).
 */

import { query } from '../database/rds-connection';

const MEAL_ORDER_TERMINAL_STATUSES = ['delivered', 'cancelled'];

export type PetMealDeleteBlockers = {
  pendingMealOrdersCount: number;
  activeMealSubscriptionsCount: number;
};

export async function getPetMealDeleteBlockers(petId: string): Promise<PetMealDeleteBlockers> {
  const orders = await query(
    `SELECT COUNT(*)::int AS count
     FROM meal_orders
     WHERE pet_id = $1::uuid
       AND LOWER(COALESCE(status, '')) NOT IN ('delivered', 'cancelled')`,
    [petId]
  );
  const subs = await query(
    `SELECT COUNT(*)::int AS count
     FROM meal_subscriptions
     WHERE pet_id = $1::uuid
       AND LOWER(COALESCE(status, '')) IN ('active', 'paused')`,
    [petId]
  );
  return {
    pendingMealOrdersCount: Number(orders.rows?.[0]?.count ?? 0),
    activeMealSubscriptionsCount: Number(subs.rows?.[0]?.count ?? 0),
  };
}

export function buildPetMealDeleteBlockMessage(
  petName: string,
  blockers: PetMealDeleteBlockers
): string | null {
  const { pendingMealOrdersCount, activeMealSubscriptionsCount } = blockers;
  if (pendingMealOrdersCount <= 0 && activeMealSubscriptionsCount <= 0) {
    return null;
  }

  const name = petName?.trim() || 'this pet';

  if (pendingMealOrdersCount > 0 && activeMealSubscriptionsCount > 0) {
    return (
      `Cannot delete ${name}'s profile. ` +
      `${pendingMealOrdersCount} meal order(s) are still awaiting delivery and ` +
      `${activeMealSubscriptionsCount} meal plan subscription(s) have upcoming deliveries. ` +
      'Wait for delivery to finish, or cancel those orders and subscriptions first.'
    );
  }

  if (pendingMealOrdersCount > 0) {
    return (
      `Cannot delete ${name}'s profile. ` +
      `${pendingMealOrdersCount} meal order(s) are still waiting to be delivered. ` +
      'Wait for delivery to complete or cancel those meal orders before deleting.'
    );
  }

  return (
    `Cannot delete ${name}'s profile. ` +
    `${activeMealSubscriptionsCount} meal plan subscription(s) still have upcoming deliveries for this pet. ` +
    'Cancel or change the meal plan before deleting.'
  );
}

/** Preserve terminal meal history rows without blocking pet DELETE (meal_orders_pet_id_fkey). */
export async function unlinkPetFromMealHistory(petId: string, customerId?: string): Promise<void> {
  const terminalList = MEAL_ORDER_TERMINAL_STATUSES.map((s) => `'${s}'`).join(', ');
  if (customerId) {
    await query(
      `UPDATE meal_orders
       SET pet_id = NULL, updated_at = NOW()
       WHERE pet_id = $1::uuid
         AND customer_id = $2::uuid
         AND LOWER(COALESCE(status, '')) IN (${terminalList})`,
      [petId, customerId]
    );
    await query(
      `UPDATE meal_subscriptions
       SET pet_id = NULL, updated_at = NOW()
       WHERE pet_id = $1::uuid
         AND customer_id = $2::uuid
         AND LOWER(COALESCE(status, '')) NOT IN ('active', 'paused')`,
      [petId, customerId]
    );
    return;
  }

  await query(
    `UPDATE meal_orders
     SET pet_id = NULL, updated_at = NOW()
     WHERE pet_id = $1::uuid
       AND LOWER(COALESCE(status, '')) IN (${terminalList})`,
    [petId]
  );
  await query(
    `UPDATE meal_subscriptions
     SET pet_id = NULL, updated_at = NOW()
     WHERE pet_id = $1::uuid
       AND LOWER(COALESCE(status, '')) NOT IN ('active', 'paused')`,
    [petId]
  );
}
