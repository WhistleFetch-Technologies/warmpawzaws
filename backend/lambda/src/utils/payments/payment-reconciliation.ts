/**
 * ============================================================================
 * PAYMENT RECONCILIATION UTILITY
 * ============================================================================
 * 
 * Handles reconciling pending bookings/payments with actual Razorpay status.
 * 
 * Two-tier reconciliation:
 *   Tier 1: Check local DB — if `payments` table has `payment_status = 'completed'`
 *           but the booking is still `pending`, update the booking.
 *   Tier 2: Check Razorpay API — if the payment record has a `razorpay_order_id`
 *           but `payment_status = 'pending'`, query Razorpay to see if the order
 *           was actually paid (e.g. verify-payment callback never fired).
 * 
 * Date: 2026-03-25
 * ============================================================================
 */

import { query } from '../../database/rds-connection';

/**
 * Reconcile pending bookings against both local payment records AND Razorpay API.
 * 
 * Mutates `bookingRows` in place to reflect reconciled state.
 * Database updates are fire-and-forget (non-blocking).
 * 
 * @param bookingRows - Array of booking row objects (will be mutated in place)
 */
export async function reconcileBookingPayments(bookingRows: any[]): Promise<void> {
  // ── Tier 1: DB-based reconciliation ──────────────────────────────────────
  // Check ALL bookings with payment_status != 'paid' (not just pending status)
  // This catches completed/cancelled bookings where payment was never recorded
  const unpaidBookings = bookingRows.filter(
    (b: any) => b.payment_status !== 'paid'
  );

  if (unpaidBookings.length === 0) return;

  const pendingIds = unpaidBookings.map((b: any) => b.id);

  try {
    const completedPayments = await query(
      `SELECT DISTINCT booking_id
       FROM payments
       WHERE booking_id = ANY($1)
         AND payment_status = 'completed'`,
      [pendingIds]
    );

    const paidBookingIds = new Set(
      completedPayments.rows.map((p: any) => p.booking_id)
    );

    if (paidBookingIds.size > 0) {
      console.log(`[RECONCILE-T1] ${paidBookingIds.size} bookings have completed payments. Reconciling...`);

      for (const bookingId of paidBookingIds) {
        query(
          `UPDATE bookings SET
             payment_status = 'paid',
             status = CASE WHEN status IN ('pending', 'pending_payment') THEN 'confirmed' ELSE status END,
             updated_at = NOW()
           WHERE id = $1 AND payment_status != 'paid'`,
          [bookingId]
        ).catch((err: any) => console.error(`[RECONCILE-T1] Update failed for ${bookingId}:`, err));
      }

      // Patch in-memory rows
      for (const row of bookingRows) {
        if (paidBookingIds.has(row.id)) {
          row.payment_status = 'paid';
          if (row.status === 'pending' || row.status === 'pending_payment') {
            row.status = 'confirmed';
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[RECONCILE-T1] Error:', err);
  }

  // ── Tier 1b: Wallet ledger debits cover booking total but booking row never flipped to paid ──
  const unpaidWalletCandidates = bookingRows.filter((b: any) => b.payment_status !== 'paid');
  if (unpaidWalletCandidates.length > 0) {
    try {
      const ids = unpaidWalletCandidates.map((b: any) => b.id);
      const wtRows = await query(
        `SELECT booking_id::text AS bid,
                COALESCE(SUM(ABS(amount::numeric)), 0)::text AS wsum
         FROM wallet_transactions
         WHERE booking_id = ANY($1::uuid[])
           AND LOWER(TRIM(COALESCE(transaction_type::text, ''))) IN (
             'debit', 'd', 'payment', 'purchase', 'withdraw'
           )
         GROUP BY booking_id`,
        [ids]
      );
      const sumByBooking = new Map<string, number>();
      for (const r of wtRows.rows || []) {
        sumByBooking.set(String(r.bid), parseFloat(String(r.wsum || '0')) || 0);
      }
      for (const row of unpaidWalletCandidates) {
        const gross = Math.round((parseFloat(String(row.total_amount ?? 0)) || 0) * 100) / 100;
        const wsum = sumByBooking.get(String(row.id)) ?? 0;
        if (gross > 0 && wsum + 0.02 >= gross) {
          console.log(
            `[RECONCILE-T1b] Wallet debits ₹${wsum} cover booking ${row.id} (₹${gross}). Marking paid.`
          );
          query(
            `UPDATE bookings SET
               payment_status = 'paid',
               status = CASE WHEN status IN ('pending_payment', 'pending') THEN 'confirmed' ELSE status END,
               updated_at = NOW()
             WHERE id = $1::uuid
               AND payment_status IS DISTINCT FROM 'paid'`,
            [row.id]
          ).catch((e: any) => console.error(`[RECONCILE-T1b] Update failed for ${row.id}:`, e));
          row.payment_status = 'paid';
          if (row.status === 'pending_payment' || row.status === 'pending') {
            row.status = 'confirmed';
          }
        }
      }
    } catch (wErr: any) {
      console.error('[RECONCILE-T1b] Error:', wErr);
    }
  }

  // ── Tier 2: Razorpay API-based reconciliation ────────────────────────────
  // Re-filter after Tier 1 patching — check ALL bookings still unpaid
  const stillUnpaidBookings = bookingRows.filter(
    (b: any) => b.payment_status !== 'paid'
  );

  if (stillUnpaidBookings.length === 0) return;

  const stillPendingIds = stillUnpaidBookings.map((b: any) => b.id);

  try {
    // Find payment records that have a Razorpay order created but are still pending
    const pendingPaymentsWithRzp = await query(
      `SELECT id, booking_id, razorpay_order_id, razorpay_payment_id
       FROM payments
       WHERE booking_id = ANY($1)
         AND razorpay_order_id IS NOT NULL
         AND payment_status = 'pending'
       ORDER BY created_at DESC`,
      [stillPendingIds]
    );

    if (pendingPaymentsWithRzp.rows.length === 0) return;

    // Limit to 3 API calls per request to keep response time reasonable
    const toCheck = pendingPaymentsWithRzp.rows.slice(0, 3);
    console.log(`[RECONCILE-T2] Checking ${toCheck.length} pending payments against Razorpay API...`);

    // Dynamic import to avoid loading Razorpay client when not needed
    const { razorpayRequest } = await import('./razorpay-client');

    for (const payment of toCheck) {
      try {
        // Fetch Razorpay order status (5s timeout – fast or skip)
        const rzpOrder = await razorpayRequest(
          `/orders/${payment.razorpay_order_id}`,
          'GET',
          undefined,
          5000
        );

        if (rzpOrder?.status === 'paid') {
          // ✅ Order is paid on Razorpay but our DB still shows pending!
          // Find the captured payment ID from Razorpay
          let razorpayPaymentId = payment.razorpay_payment_id;

          if (!razorpayPaymentId) {
            try {
              const rzpPayments = await razorpayRequest(
                `/orders/${payment.razorpay_order_id}/payments`,
                'GET',
                undefined,
                5000
              );
              const capturedPayment = rzpPayments?.items?.find(
                (p: any) => p.status === 'captured'
              );
              if (capturedPayment) {
                razorpayPaymentId = capturedPayment.id;
              }
            } catch {
              // Non-critical: we can still update without the payment ID
            }
          }

          console.log(
            `[RECONCILE-T2] ✅ Razorpay order ${payment.razorpay_order_id} is PAID` +
            (razorpayPaymentId ? ` (payment: ${razorpayPaymentId})` : '') +
            `. Updating booking ${payment.booking_id}...`
          );

          // Update payment record
          query(
            `UPDATE payments SET
               payment_status = 'completed',
               razorpay_payment_id = COALESCE($1, razorpay_payment_id),
               completed_at = COALESCE(completed_at, NOW()),
               updated_at = NOW()
             WHERE id = $2 AND payment_status != 'completed'`,
            [razorpayPaymentId, payment.id]
          ).catch((err: any) =>
            console.error(`[RECONCILE-T2] Failed to update payment ${payment.id}:`, err)
          );

          // Update booking record
          query(
            `UPDATE bookings SET
               payment_status = 'paid',
               status = CASE WHEN status IN ('pending', 'pending_payment') THEN 'confirmed' ELSE status END,
               updated_at = NOW()
             WHERE id = $1 AND payment_status != 'paid'`,
            [payment.booking_id]
          ).catch((err: any) =>
            console.error(`[RECONCILE-T2] Failed to update booking ${payment.booking_id}:`, err)
          );

          // Patch in-memory row
          for (const row of bookingRows) {
            if (row.id === payment.booking_id) {
              row.payment_status = 'paid';
              if (row.status === 'pending' || row.status === 'pending_payment') {
                row.status = 'confirmed';
              }
            }
          }
        } else {
          console.log(
            `[RECONCILE-T2] Razorpay order ${payment.razorpay_order_id} status: ${rzpOrder?.status || 'unknown'} (not paid yet)`
          );
        }
      } catch (rzpErr: any) {
        console.warn(
          `[RECONCILE-T2] Failed to check order ${payment.razorpay_order_id}:`,
          rzpErr?.message
        );
        // Non-critical: continue with next payment
      }
    }
  } catch (rzpReconcileErr: any) {
    console.error('[RECONCILE-T2] Error during Razorpay reconciliation:', rzpReconcileErr);
  }
}
