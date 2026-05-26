/**
 * When a mirrored `meal_orders` row (canonical subscription session) is marked delivered,
 * keep `meal_subscription_deliveries` + `completed_sessions` in sync.
 */
import { query } from '../database/rds-connection';
import { markMealSubscriptionDeliveryDeliveredById } from '../services/meal-subscription/meal-subscription-operations-service';

export function extractCanonicalDeliveryIdFromMealOrderRow(row: Record<string, unknown>): string | null {
  const snap = row.purchase_snapshot;
  if (snap != null) {
    let o: Record<string, unknown> = {};
    if (typeof snap === 'string') {
      try {
        o = JSON.parse(snap) as Record<string, unknown>;
      } catch {
        o = {};
      }
    } else if (typeof snap === 'object' && !Array.isArray(snap)) {
      o = snap as Record<string, unknown>;
    }
    const id = o.canonicalDeliveryId;
    if (id != null && String(id).trim()) return String(id).trim();
  }
  const si = String(row.special_instructions || '');
  const m = si.match(/__canonical_delivery_id__:([^_]+)__/);
  return m?.[1]?.trim() || null;
}

export async function syncCanonicalMealSubscriptionDeliveryWhenMealOrderDelivered(mealOrderId: string): Promise<void> {
  try {
    const r = await query(
      `SELECT purchase_snapshot, special_instructions, subscription_id, status FROM meal_orders WHERE id = $1`,
      [mealOrderId],
    ).catch(() => ({ rows: [] as Record<string, unknown>[] }));
    const row = r.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) return;
    if (String(row.status || '').toLowerCase() !== 'delivered') return;

    const cid = extractCanonicalDeliveryIdFromMealOrderRow(row);
    if (!cid) return;

    const subId = row.subscription_id != null ? String(row.subscription_id) : null;
    await markMealSubscriptionDeliveryDeliveredById(cid, subId);
  } catch (e) {
    console.warn('[sync-canonical-delivery-from-meal-order] failed', mealOrderId, e);
  }
}
