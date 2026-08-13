/**
 * ============================================================================
 * PAYMENT RECONCILIATION UTILITY
 * ============================================================================
 *
 * Reconciles pending bookings/payments with Razorpay via the single
 * finalizeCapturedPayment() state machine (verify / webhook / expiry / T1 / T2).
 *
 * Date: 2026-03-25
 * ============================================================================
 */

import { query } from '../../database/rds-connection';
import {
  backfillMissingBookingStartOtps,
  scheduleBookingStartOtpIfNeeded,
} from '../booking-start-otp';
import { finalizeCapturedPayment } from './finalize-captured-payment';

/**
 * Reconcile pending bookings against both local payment records AND Razorpay API.
 *
 * Mutates `bookingRows` in place to reflect reconciled state.
 */
export async function reconcileBookingPayments(bookingRows: any[]): Promise<void> {
  try {
    // ── Tier 1: DB-based reconciliation ──────────────────────────────────────
    const unpaidBookings = bookingRows.filter((b: any) => b.payment_status !== 'paid');

    if (unpaidBookings.length > 0) {
      const pendingIds = unpaidBookings.map((b: any) => b.id);

      try {
        const completedPayments = await query(
          `SELECT DISTINCT ON (booking_id) id, booking_id, razorpay_order_id, razorpay_payment_id
           FROM payments
           WHERE booking_id = ANY($1)
             AND payment_status = 'completed'
           ORDER BY booking_id, created_at DESC NULLS LAST`,
          [pendingIds]
        );

        if (completedPayments.rows.length > 0) {
          console.log(
            `[RECONCILE-T1] ${completedPayments.rows.length} bookings have completed payments. Reconciling...`
          );

          for (const pay of completedPayments.rows) {
            const fin = await finalizeCapturedPayment({
              source: 'reconciliation',
              paymentRowId: String(pay.id),
              razorpayOrderId: pay.razorpay_order_id ? String(pay.razorpay_order_id) : null,
              razorpayPaymentId: pay.razorpay_payment_id ? String(pay.razorpay_payment_id) : null,
            }).catch((err: any) => {
              console.error(`[RECONCILE-T1] Finalize failed for ${pay.booking_id}:`, err);
              return null;
            });
            if (
              fin &&
              (fin.outcome === 'fulfilled' || fin.outcome === 'already_final') &&
              fin.newEntityStatus === 'confirmed'
            ) {
              scheduleBookingStartOtpIfNeeded(String(pay.booking_id), '[RECONCILE-T1]');
            }
          }

          for (const row of bookingRows) {
            const match = completedPayments.rows.find((p: any) => p.booking_id === row.id);
            if (!match) continue;
            row.payment_status = 'paid';
            if (
              row.status === 'pending' ||
              row.status === 'pending_payment' ||
              (row.status === 'cancelled' &&
                String(row.cancellation_reason || '') === 'payment_window_expired')
            ) {
              row.status = 'confirmed';
            }
          }
        }
      } catch (err: any) {
        console.error('[RECONCILE-T1] Error:', err);
      }
    }

    // ── Tier 1a: Paid on booking row but hold-expiry left status cancelled ─────
    const paidButCancelled = bookingRows.filter(
      (b: any) =>
        String(b.payment_status || '').toLowerCase() === 'paid' &&
        String(b.status || '') === 'cancelled' &&
        String(b.cancellation_reason || '') === 'payment_window_expired'
    );
    for (const row of paidButCancelled) {
      console.log(`[RECONCILE-T1a] Reconciling paid+cancelled booking ${row.id} via finalizer`);
      const { rows: payRows } = await query(
        `SELECT id, razorpay_order_id, razorpay_payment_id
         FROM payments
         WHERE booking_id = $1::uuid
           AND LOWER(COALESCE(payment_status, '')) IN ('completed', 'paid')
         ORDER BY created_at DESC
         LIMIT 1`,
        [row.id]
      );
      if (payRows[0]) {
        const fin = await finalizeCapturedPayment({
          source: 'reconciliation',
          paymentRowId: String(payRows[0].id),
          razorpayOrderId: payRows[0].razorpay_order_id ? String(payRows[0].razorpay_order_id) : null,
          razorpayPaymentId: payRows[0].razorpay_payment_id
            ? String(payRows[0].razorpay_payment_id)
            : null,
        }).catch((e: any) => {
          console.error(`[RECONCILE-T1a] Finalize failed for ${row.id}:`, e);
          return null;
        });
        if (fin?.outcome === 'fulfilled' && fin.newEntityStatus === 'confirmed') {
          row.status = 'confirmed';
          row.cancellation_reason = null;
          scheduleBookingStartOtpIfNeeded(String(row.id), '[RECONCILE-T1a]');
        }
      }
    }

    // ── Tier 1b: Wallet ledger debits cover booking total but booking row never flipped to paid ──
    const unpaidWalletCandidates = bookingRows.filter((b: any) => b.payment_status !== 'paid');
    if (unpaidWalletCandidates.length > 0) {
      try {
        const ids = unpaidWalletCandidates.map((b: any) => b.id);
        let wtRows;
        try {
          wtRows = await query(
            `SELECT reference_id::text AS bid,
                    COALESCE(SUM(ABS(amount::numeric)), 0)::text AS wsum
             FROM wallet_transactions
             WHERE reference_id = ANY($1::uuid[])
               AND LOWER(TRIM(COALESCE(transaction_type::text, ''))) IN (
                 'debit', 'd', 'payment', 'purchase', 'withdraw'
               )
             GROUP BY reference_id`,
            [ids]
          );
        } catch {
          wtRows = await query(
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
        }
        const sumByBooking = new Map<string, number>();
        for (const r of wtRows.rows || []) {
          sumByBooking.set(String(r.bid), parseFloat(String(r.wsum || '0')) || 0);
        }
        for (const row of unpaidWalletCandidates) {
          const gross = Math.round((parseFloat(String(row.total_amount ?? 0)) || 0) * 100) / 100;
          const wsum = sumByBooking.get(String(row.id)) ?? 0;
          const st = String(row.status || '');
          if (st === 'cancelled') continue;
          if (gross > 0 && wsum + 0.02 >= gross) {
            console.log(
              `[RECONCILE-T1b] Wallet debits ₹${wsum} cover booking ${row.id} (₹${gross}). Marking paid.`
            );
            await query(
              `UPDATE bookings SET
                 payment_status = 'paid',
                 status = CASE
                   WHEN status IN ('pending', 'pending_payment') THEN 'confirmed'
                   ELSE status
                 END,
                 updated_at = NOW()
               WHERE id = $1::uuid
                 AND payment_status IS DISTINCT FROM 'paid'
                 AND status IN ('pending', 'pending_payment')`,
              [row.id]
            ).catch((e: any) => console.error(`[RECONCILE-T1b] Update failed for ${row.id}:`, e));
            row.payment_status = 'paid';
            if (row.status === 'pending_payment' || row.status === 'pending') {
              row.status = 'confirmed';
            }
            scheduleBookingStartOtpIfNeeded(String(row.id), '[RECONCILE-T1b]');
          }
        }
      } catch (wErr: any) {
        console.error('[RECONCILE-T1b] Error:', wErr);
      }
    }

    // ── Tier 2: Razorpay API-based reconciliation ────────────────────────────
    const stillUnpaidBookings = bookingRows.filter((b: any) => b.payment_status !== 'paid');

    if (stillUnpaidBookings.length > 0) {
      const stillPendingIds = stillUnpaidBookings.map((b: any) => b.id);

      try {
        const pendingPaymentsWithRzp = await query(
          `SELECT id, booking_id, razorpay_order_id, razorpay_payment_id
           FROM payments
           WHERE booking_id = ANY($1)
             AND razorpay_order_id IS NOT NULL
             AND LOWER(COALESCE(payment_status, '')) IN ('pending', 'failed')
           ORDER BY created_at DESC`,
          [stillPendingIds]
        );

        if (pendingPaymentsWithRzp.rows.length > 0) {
          const toCheck = pendingPaymentsWithRzp.rows.slice(0, 3);
          console.log(
            `[RECONCILE-T2] Checking ${toCheck.length} pending payments against Razorpay API...`
          );

          const { razorpayRequest } = await import('./razorpay-client');

          for (const payment of toCheck) {
            try {
              const rzpOrder = await razorpayRequest(
                `/orders/${payment.razorpay_order_id}`,
                'GET',
                undefined,
                5000
              );

              if (rzpOrder?.status === 'paid') {
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
                    /* non-critical */
                  }
                }

                console.log(
                  `[RECONCILE-T2] ✅ Razorpay order ${payment.razorpay_order_id} is PAID` +
                    (razorpayPaymentId ? ` (payment: ${razorpayPaymentId})` : '') +
                    `. Finalizing booking ${payment.booking_id}...`
                );

                const fin = await finalizeCapturedPayment({
                  source: 'reconciliation',
                  paymentRowId: String(payment.id),
                  razorpayOrderId: String(payment.razorpay_order_id),
                  razorpayPaymentId: razorpayPaymentId || null,
                });

                if (fin.outcome === 'fulfilled' || fin.outcome === 'already_final') {
                  scheduleBookingStartOtpIfNeeded(String(payment.booking_id), '[RECONCILE-T2]');
                  for (const row of bookingRows) {
                    if (row.id === payment.booking_id) {
                      row.payment_status = 'paid';
                      if (
                        row.status === 'pending' ||
                        row.status === 'pending_payment' ||
                        (row.status === 'cancelled' &&
                          String(row.cancellation_reason || '') === 'payment_window_expired')
                      ) {
                        row.status = 'confirmed';
                        row.cancellation_reason = null;
                      }
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
            }
          }
        }
      } catch (rzpReconcileErr: any) {
        console.error('[RECONCILE-T2] Error during Razorpay reconciliation:', rzpReconcileErr);
      }
    }
  } finally {
    try {
      await backfillMissingBookingStartOtps(bookingRows);
    } catch (t3Err: any) {
      console.error('[RECONCILE-T3] OTP backfill error:', t3Err);
    }
  }
}
