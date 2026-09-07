/**
 * Split-pay wallet capture: debit only when the Razorpay (or wallet-only) payment
 * actually succeeds. Abandoned / expired pending_payment bookings credit the net
 * debit back so the customer is not left short.
 */

import type { PoolClient } from 'pg';
import { query } from '../database/rds-connection';
import { creditCustomerWalletForBookingRefund } from './credit-customer-wallet';
import { debitCustomerWalletForBookingInTransaction } from './wallet-operations';
import {
  computeWalletBookingSplit,
  resolveLockedBookingGrossFromNotes,
} from './booking-financial-gross';

export function shouldDebitWalletImmediately(fullyWallet: boolean): boolean {
  return fullyWallet === true;
}

export async function sumBookingWalletLedger(bookingId: string): Promise<{
  debited: number;
  credited: number;
  net: number;
}> {
  if (!bookingId) return { debited: 0, credited: 0, net: 0 };
  const like = `%${bookingId}%`;
  const debit = await query(
    `SELECT COALESCE(SUM(amount), 0)::text AS total
     FROM wallet_transactions
     WHERE transaction_type = 'debit'
       AND (
         (reference_type = 'booking_payment' AND reference_id::text = $1)
         OR booking_id = $1::uuid
         OR description ILIKE $2
       )`,
    [bookingId, like]
  );
  const credited = await query(
    `SELECT COALESCE(SUM(amount), 0)::text AS total
     FROM wallet_transactions
     WHERE transaction_type = 'credit'
       AND COALESCE(reference_type, '') IN ('booking_refund', 'booking_refund_sync')
       AND (
         booking_id = $1::uuid
         OR reference_id::text = $1
         OR description ILIKE $2
       )`,
    [bookingId, like]
  );
  const debited = Math.round((parseFloat(String(debit.rows[0]?.total ?? '0')) || 0) * 100) / 100;
  const creditedAmt =
    Math.round((parseFloat(String(credited.rows[0]?.total ?? '0')) || 0) * 100) / 100;
  const net = Math.round((debited - creditedAmt) * 100) / 100;
  return { debited, credited: creditedAmt, net: net > 0.009 ? net : 0 };
}

/**
 * Credit back any outstanding booking-payment wallet debit (idempotent).
 * Used when Razorpay never captured: hold expiry, checkout abandon, unfulfillable capture.
 */
export async function creditNetWalletDebitForAbandonedBooking(params: {
  customerId: string;
  bookingId: string;
  label?: 'booking' | 'appointment';
}): Promise<{ credited: number; alreadyCredited?: boolean }> {
  const customerId = String(params.customerId || '').trim();
  const bookingId = String(params.bookingId || '').trim();
  if (!customerId || !bookingId) return { credited: 0 };
  const ledger = await sumBookingWalletLedger(bookingId);
  if (ledger.net <= 0.009) return { credited: 0, alreadyCredited: ledger.credited > 0.009 };
  const result = await creditCustomerWalletForBookingRefund({
    customerId,
    bookingId,
    refundAmount: ledger.net,
    refundPercentage: 100,
    label: params.label ?? 'booking',
  });
  return {
    credited: result.alreadyCredited ? 0 : ledger.net,
    alreadyCredited: result.alreadyCredited,
  };
}

export async function debitReservedWalletForBookingInTransaction(
  client: PoolClient,
  params: {
    bookingId: string;
    customerId: string;
    notes?: unknown;
    bookingTotalAmount?: unknown;
    intendedWalletFallback?: number;
    razorpayOrderId?: string | null;
    idempotencyKey?: string;
  }
): Promise<{ debited: number; alreadyDebited: number }> {
  const bookingId = String(params.bookingId || '');
  const customerId = String(params.customerId || '');
  if (!bookingId || !customerId) return { debited: 0, alreadyDebited: 0 };

  const locked = resolveLockedBookingGrossFromNotes(params.notes);
  const intendedFromNotes = Math.round((locked?.walletAmount ?? 0) * 100) / 100;
  const intendedFallback =
    Math.round((Number(params.intendedWalletFallback) || 0) * 100) / 100;
  const intendedWallet = Math.max(intendedFromNotes, intendedFallback);
  if (intendedWallet <= 0.009) return { debited: 0, alreadyDebited: 0 };

  const grossAtVerify =
    locked && locked.grossTotal > 0
      ? locked.grossTotal
      : Math.round((parseFloat(String(params.bookingTotalAmount ?? 0)) || 0) * 100) / 100;
  const gstAtVerify = locked?.totalTax ?? 0;

  let alreadyDebited = 0;
  try {
    const existingDebits = await client.query(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM wallet_transactions
       WHERE transaction_type = 'debit'
         AND (
           (reference_type = 'booking_payment' AND reference_id::text = $1)
           OR booking_id = $1::uuid
           OR description ILIKE $2
         )`,
      [bookingId, `%${bookingId}%`]
    );
    alreadyDebited =
      Math.round((parseFloat(String(existingDebits.rows[0]?.total ?? '0')) || 0) * 100) / 100;
  } catch (existingDebitErr: any) {
    console.warn(
      '[WALLET-CAPTURE] existing wallet debit lookup skipped:',
      existingDebitErr?.message
    );
  }

  const balRes = await client.query(
    `SELECT COALESCE(balance, 0)::text AS b FROM customer_wallets WHERE customer_id = $1::uuid FOR UPDATE`,
    [customerId]
  );
  const bal = parseFloat(String(balRes.rows[0]?.b ?? '0')) || 0;
  const split = computeWalletBookingSplit({
    grossTotal: grossAtVerify > 0 ? grossAtVerify : intendedWallet + gstAtVerify,
    walletIntent: intendedWallet,
    walletBalance: bal + alreadyDebited,
    gstAmount: gstAtVerify,
  });
  const needDebit = Math.max(
    0,
    Math.round((split.walletApplied - alreadyDebited) * 100) / 100
  );
  if (needDebit <= 0.009) {
    return { debited: alreadyDebited, alreadyDebited };
  }

  const deb = await debitCustomerWalletForBookingInTransaction(client, {
    customerId,
    bookingId,
    amount: needDebit,
    idempotencyKey: params.idempotencyKey ?? `rz-verify-wallet-${bookingId}`,
  });
  const justDebited = Math.round((deb?.debited ?? needDebit) * 100) / 100;
  const totalDebited = Math.round((alreadyDebited + justDebited) * 100) / 100;

  if (justDebited > 0.009 && params.razorpayOrderId) {
    try {
      await client.query(
        `UPDATE payments
         SET wallet_amount_used = GREATEST(COALESCE(wallet_amount_used, 0), $1::numeric),
             updated_at = NOW()
         WHERE razorpay_order_id = $2`,
        [totalDebited, params.razorpayOrderId]
      );
    } catch (walletColErr: any) {
      console.warn('[WALLET-CAPTURE] wallet_amount_used update skipped:', walletColErr?.message);
    }
  }

  return { debited: totalDebited, alreadyDebited };
}
