/**
 * Canonical subscription sessions mirror into meal_orders with canonicalDeliveryId in purchase_snapshot
 * (and a marker in special_instructions). delivery_tracking may reference only subscription_delivery_id.
 */
import { query } from '../database/rds-connection';

export async function resolveMealOrderIdForSubscriptionDelivery(
  subscriptionDeliveryId: string,
): Promise<string | null> {
  const sid = String(subscriptionDeliveryId || '').trim();
  if (!sid) return null;

  const marker = `%__canonical_delivery_id__:${sid}__%`;
  const byInstructions = await query(`SELECT id FROM meal_orders WHERE special_instructions LIKE $1 LIMIT 1`, [
    marker,
  ]).catch(() => ({ rows: [] as { id: string }[] }));
  if (byInstructions.rows?.length) return String(byInstructions.rows[0].id);

  const bySnap = await query(
    `SELECT id FROM meal_orders
     WHERE purchase_snapshot IS NOT NULL
       AND purchase_snapshot->>'canonicalDeliveryId' = $1
     LIMIT 1`,
    [sid],
  ).catch(() => ({ rows: [] as { id: string }[] }));

  return bySnap.rows?.length ? String(bySnap.rows[0].id) : null;
}
