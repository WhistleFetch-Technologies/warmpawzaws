/**
 * Ecommerce Loyalty Utilities
 *
 * Manages deferred loyalty point awards for ecommerce orders.
 *
 * Flow:
 *   1. Order delivered → insertPendingLoyaltyAward (row with award_after = delivered_at + window)
 *   2. Customer views rewards page → processCustomerDuePendingAwards awards any overdue rows
 *   3. Return initiated → cancelPendingLoyaltyAward marks row cancelled
 *   4. Return approved (after points already awarded) → reverseLoyaltyAwardForOrder reverts points
 */

import { query, withTransaction } from '../database/rds-connection';
import {
  CUSTOMER_LOYALTY_EARN_AND_REDEEM_DISABLED,
  loyaltyPointsService,
} from '../lib/services/loyalty&reward/loyalty-points-service';

const ECOMMERCE_LOYALTY_ACTION = 'buy_product';

/**
 * Insert a pending loyalty award row when an order is marked delivered.
 * Uses ON CONFLICT DO NOTHING so it is safe to call multiple times for the same order.
 */
export async function insertPendingLoyaltyAward(params: {
  orderId: string;
  customerId: string;
  amount: number;
  windowDays: number;
}): Promise<void> {
  const { orderId, customerId, amount, windowDays } = params;
  if (CUSTOMER_LOYALTY_EARN_AND_REDEEM_DISABLED) {
    console.info('[ECOMMERCE-LOYALTY] insertPendingLoyaltyAward skipped (customer loyalty paused)');
    return;
  }
  try {
    await query(
      `INSERT INTO ecommerce_loyalty_pending_awards
         (order_id, customer_id, amount, action_name, award_after, status)
       VALUES
         ($1::uuid, $2::uuid, $3, $4, NOW() + ($5 || ' days')::INTERVAL, 'pending')
       ON CONFLICT (order_id) DO NOTHING`,
      [orderId, customerId, amount, ECOMMERCE_LOYALTY_ACTION, String(windowDays)]
    );
  } catch (err: any) {
    console.warn('[ECOMMERCE-LOYALTY] insertPendingLoyaltyAward failed (non-fatal):', err?.message);
  }
}

/**
 * Cancel a pending loyalty award row when the customer initiates a return.
 * No-ops gracefully if no row exists or if it was already awarded/cancelled.
 */
export async function cancelPendingLoyaltyAward(
  orderId: string,
  reason: string
): Promise<void> {
  try {
    await query(
      `UPDATE ecommerce_loyalty_pending_awards
       SET    status = 'cancelled',
              cancelled_at = NOW(),
              cancel_reason = $2
       WHERE  order_id = $1::uuid
         AND  status = 'pending'`,
      [orderId, reason]
    );
  } catch (err: any) {
    console.warn('[ECOMMERCE-LOYALTY] cancelPendingLoyaltyAward failed (non-fatal):', err?.message);
  }
}

/**
 * Process all overdue pending awards for a customer.
 * Called lazily from GET /customer/:id/rewards/points so points appear the
 * next time the customer opens the Rewards page after the return window expires.
 *
 * For each overdue row (award_after <= NOW, status = 'pending'):
 *   - Confirms no active return exists for the order
 *   - Calls loyaltyPointsService.awardPoints
 *   - Marks row as 'awarded'
 */
export async function processCustomerDuePendingAwards(customerId: string): Promise<void> {
  if (CUSTOMER_LOYALTY_EARN_AND_REDEEM_DISABLED) {
    console.info('[ECOMMERCE-LOYALTY] processCustomerDuePendingAwards skipped (customer loyalty paused)');
    return;
  }
  try {
    const dueRows = await query(
      `SELECT id, order_id::text AS order_id, amount, action_name
       FROM ecommerce_loyalty_pending_awards
       WHERE customer_id = $1::uuid
         AND status = 'pending'
         AND award_after <= NOW()
       FOR UPDATE SKIP LOCKED`,
      [customerId]
    );

    if (!dueRows.rows.length) return;

    for (const row of dueRows.rows) {
      try {
        // Check for active (non-cancelled/rejected) return request
        const ret = await query(
          `SELECT 1 FROM return_requests
           WHERE order_id = $1::uuid
             AND status NOT IN ('cancelled', 'rejected')
           LIMIT 1`,
          [row.order_id]
        );
        if (ret.rows.length > 0) {
          // Return is in progress — skip for now; cancellation will handle the row
          continue;
        }

        await loyaltyPointsService.awardPoints({
          customerId,
          actionName: row.action_name || ECOMMERCE_LOYALTY_ACTION,
          amount: parseFloat(String(row.amount || '0')),
          referenceType: 'order',
          referenceId: row.order_id,
          description: `Ecommerce order reward`,
        });

        await query(
          `UPDATE ecommerce_loyalty_pending_awards
           SET status = 'awarded', awarded_at = NOW()
           WHERE id = $1`,
          [row.id]
        );
      } catch (rowErr: any) {
        console.warn(
          `[ECOMMERCE-LOYALTY] Failed to process pending award id=${row.id}:`,
          rowErr?.message
        );
      }
    }
  } catch (err: any) {
    console.warn('[ECOMMERCE-LOYALTY] processCustomerDuePendingAwards failed (non-fatal):', err?.message);
  }
}

/**
 * Reverse a previously awarded loyalty earn when a return is approved.
 * Atomically:
 *   1. Reads original points from loyalty_transactions
 *   2. Inserts a negative 'reversed' loyalty_transaction
 *   3. Decrements customer_loyalty_points.total_points (floor at 0)
 *   4. Marks the pending_award row as cancelled
 */
export async function reverseLoyaltyAwardForOrder(
  orderId: string,
  customerId: string
): Promise<void> {
  try {
    await withTransaction(async (client) => {
      // Find the original earned points transaction for this order
      const txn = await client.query(
        `SELECT points FROM loyalty_transactions
         WHERE reference_type = 'order'
           AND reference_id = $1::uuid
           AND transaction_type IN ('earned', 'award', 'bonus')
           AND customer_id = $2::uuid
         ORDER BY created_at DESC
         LIMIT 1`,
        [orderId, customerId]
      );

      if (!txn.rows.length) {
        // Nothing to reverse — mark award row cancelled and return
        await client.query(
          `UPDATE ecommerce_loyalty_pending_awards
           SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = 'return_approved_no_txn'
           WHERE order_id = $1::uuid`,
          [orderId]
        );
        return;
      }

      const pointsToReverse = Math.abs(parseInt(String(txn.rows[0].points || '0'), 10));
      if (pointsToReverse <= 0) return;

      // Insert reversal transaction
      await client.query(
        `INSERT INTO loyalty_transactions
           (customer_id, transaction_type, points, reference_type, reference_id, description)
         VALUES ($1::uuid, 'reversed', $2, 'order', $3::uuid, $4)`,
        [customerId, -pointsToReverse, orderId, `Points reversed: return approved for order`]
      );

      // Decrement total_points (cannot go below 0)
      await client.query(
        `UPDATE customer_loyalty_points
         SET total_points = GREATEST(0, total_points - $1),
             updated_at   = NOW()
         WHERE customer_id = $2::uuid`,
        [pointsToReverse, customerId]
      );

      // Mark pending award row as cancelled
      await client.query(
        `UPDATE ecommerce_loyalty_pending_awards
         SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = 'return_approved'
         WHERE order_id = $1::uuid`,
        [orderId]
      );
    });
  } catch (err: any) {
    console.warn('[ECOMMERCE-LOYALTY] reverseLoyaltyAwardForOrder failed (non-fatal):', err?.message);
  }
}
