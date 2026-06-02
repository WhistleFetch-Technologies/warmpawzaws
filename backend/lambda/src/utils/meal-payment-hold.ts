/**
 * 5-minute payment hold for unpaid one-time meal_orders (Razorpay checkout abandoned).
 */

import { query, withTransaction } from '../database/rds-connection';
import { logAuditEntry } from './audit-log';
import {
  paymentHoldExpiresAt,
  secondsRemainingUntilHoldExpiry,
  PAYMENT_HOLD_TTL_SECONDS,
} from './payment-hold';

export { paymentHoldExpiresAt, secondsRemainingUntilHoldExpiry, PAYMENT_HOLD_TTL_SECONDS };

const MEAL_UNPAID_PAYMENT = `LOWER(COALESCE(mo.payment_status, '')) NOT IN ('paid', 'completed', 'expired', 'refunded')`;
const MEAL_NOT_TERMINAL = `LOWER(COALESCE(mo.status, '')) NOT IN ('cancelled', 'delivered')`;

export function isMealOrderPaymentHoldActive(row: {
  status?: string | null;
  payment_status?: string | null;
  payment_hold_expires_at?: Date | string | null;
}): boolean {
  const ps = String(row.payment_status || '').toLowerCase();
  if (ps === 'paid' || ps === 'completed' || ps === 'expired' || ps === 'refunded') return false;
  const st = String(row.status || '').toLowerCase();
  if (st === 'cancelled' || st === 'delivered') return false;
  const exp = row.payment_hold_expires_at;
  if (!exp) return true;
  return new Date(exp).getTime() > Date.now();
}

export function isMealOrderPaymentHoldExpired(row: {
  status?: string | null;
  payment_status?: string | null;
  payment_hold_expires_at?: Date | string | null;
  created_at?: Date | string | null;
}): boolean {
  const ps = String(row.payment_status || '').toLowerCase();
  if (ps === 'paid' || ps === 'completed' || ps === 'expired' || ps === 'refunded') return false;
  const st = String(row.status || '').toLowerCase();
  if (st === 'cancelled' || st === 'delivered') return false;
  const exp = row.payment_hold_expires_at;
  if (exp) return new Date(exp).getTime() <= Date.now();
  if (row.created_at) {
    return Date.now() - new Date(String(row.created_at)).getTime() >= PAYMENT_HOLD_TTL_SECONDS * 1000;
  }
  return false;
}

export interface ExpireMealPaymentHoldsResult {
  expiredCount: number;
  orderIds: string[];
  timestamp: string;
}

/**
 * Cancel unpaid meal orders whose hold window has elapsed.
 */
export async function expireMealPaymentHolds(options?: {
  limit?: number;
  requestId?: string;
}): Promise<ExpireMealPaymentHoldsResult> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  const requestId = options?.requestId;

  const { rows } = await query(
    `SELECT mo.id, mo.status, mo.payment_status, mo.vendor_id, mo.customer_id
     FROM meal_orders mo
     WHERE ${MEAL_UNPAID_PAYMENT}
       AND ${MEAL_NOT_TERMINAL}
       AND (
         (mo.payment_hold_expires_at IS NOT NULL AND mo.payment_hold_expires_at <= NOW())
         OR (
           mo.payment_hold_expires_at IS NULL
           AND mo.created_at IS NOT NULL
           AND mo.created_at + INTERVAL '5 minutes' <= NOW()
         )
       )
     ORDER BY COALESCE(mo.payment_hold_expires_at, mo.created_at) ASC
     LIMIT $1`,
    [limit]
  );

  const orderIds: string[] = [];
  const reason = 'payment_window_expired';

  for (const row of rows) {
    const orderId = String(row.id);
    const oldStatus = String(row.status || 'pending');
    const oldPaymentStatus = String(row.payment_status || 'pending');
    try {
      await withTransaction(async (client) => {
        const locked = await client.query(
          `SELECT id, status, payment_status FROM meal_orders WHERE id = $1::uuid FOR UPDATE`,
          [orderId]
        );
        if (locked.rows.length === 0) return;
        const cur = locked.rows[0];
        const curPs = String(cur.payment_status || '').toLowerCase();
        if (['paid', 'completed', 'expired', 'refunded'].includes(curPs)) return;
        const curSt = String(cur.status || '').toLowerCase();
        if (['cancelled', 'delivered'].includes(curSt)) return;

        await client.query(
          `UPDATE meal_orders
           SET status = 'cancelled',
               payment_status = 'expired',
               cancelled_at = NOW(),
               cancellation_reason = $2,
               updated_at = NOW()
           WHERE id = $1::uuid`,
          [orderId, reason]
        );
      });

      await logAuditEntry({
        entityType: 'meal_order',
        entityId: orderId,
        action: 'update',
        oldValues: { status: oldStatus, payment_status: oldPaymentStatus },
        newValues: {
          status: 'cancelled',
          payment_status: 'expired',
          cancellation_reason: reason,
          paymentHoldExpired: true,
        },
        changedFields: ['status', 'payment_status', 'cancellation_reason'],
        actorId: 'system',
        actorType: 'system',
        requestId,
      });

      orderIds.push(orderId);
    } catch (err) {
      console.warn('[meal-payment-hold] Failed to expire meal order', orderId, err);
    }
  }

  return {
    expiredCount: orderIds.length,
    orderIds,
    timestamp: new Date().toISOString(),
  };
}
