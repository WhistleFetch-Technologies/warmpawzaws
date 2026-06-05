/**
 * Original-payment (Razorpay) refunds for meal_orders and meal subscriptions.
 * Mirrors booking-original-refund: payments + refunds rows so Razorpay webhooks reconcile.
 */

import { query, withTransaction } from '../../database/rds-connection';
import { getRazorpayClient } from './razorpay-client';
import type { OriginalPaymentRefundResult, RefundInitiator } from './booking-original-refund';
import { mealOrderWalletDebitFromRow, resolveMealOrderWalletPaidInr, isLikelyRazorpayPaymentCaptureId } from '../meal-order-wallet';

export type { OriginalPaymentRefundResult };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function splitRefundAmount(
  refundAmount: number,
  walletPaid: number,
  gatewayPaid: number,
): { walletSlice: number; gatewaySlice: number } {
  const totalPaid = round2(walletPaid + gatewayPaid);
  if (refundAmount <= 0.009) return { walletSlice: 0, gatewaySlice: 0 };
  if (totalPaid <= 0.009) {
    return { walletSlice: 0, gatewaySlice: round2(refundAmount) };
  }
  const walletShare = walletPaid / totalPaid;
  const walletSlice = round2(refundAmount * walletShare);
  const gatewaySlice = round2(Math.max(0, refundAmount - walletSlice));
  return { walletSlice, gatewaySlice };
}

async function callRazorpayRefund(
  razorpayPaymentId: string,
  amountInr: number,
  notes: Record<string, string>,
): Promise<{ id: string; status: string }> {
  const razorpay = getRazorpayClient();
  const refundResult = await razorpay.payments.refund({
    payment_id: razorpayPaymentId,
    amount: Math.round(amountInr * 100),
    notes,
  });
  return {
    id: String((refundResult as { id?: string }).id ?? ''),
    status: String((refundResult as { status?: string }).status ?? 'processing'),
  };
}

type GatewayPaymentRow = {
  id: string;
  amount: number;
  razorpay_payment_id: string;
  payment_status: string;
  customer_id: string;
};

async function sumProcessedRefundsForPayment(paymentId: string): Promise<number> {
  const res = await query(
    `SELECT COALESCE(SUM(refund_amount), 0)::text AS total
     FROM refunds
     WHERE payment_id = $1::uuid
       AND refund_status IN ('completed', 'processing', 'approved', 'processed')`,
    [paymentId],
  );
  return parseFloat(String((res as any).rows?.[0]?.total ?? '0')) || 0;
}

async function findActiveOriginalRefundForPayment(
  paymentId: string,
): Promise<{ id: string; refund_status: string } | null> {
  const res = await query(
    `SELECT id::text, refund_status
     FROM refunds
     WHERE payment_id = $1::uuid
       AND refund_method = 'original'
       AND refund_status NOT IN ('failed', 'rejected')
     ORDER BY requested_at DESC NULLS LAST
     LIMIT 1`,
    [paymentId],
  );
  const row = (res as any).rows?.[0];
  return row?.id ? { id: String(row.id), refund_status: String(row.refund_status) } : null;
}

async function ensureMealGatewayPaymentRecord(input: {
  transactionId: string;
  customerId: string;
  vendorId: string | null;
  amount: number;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  paymentStatus?: string;
}): Promise<GatewayPaymentRow> {
  const { transactionId, customerId, vendorId, amount, razorpayOrderId, razorpayPaymentId } = input;
  const existing = await query(
    `SELECT id::text, amount::text, razorpay_payment_id, payment_status, customer_id::text
     FROM payments
     WHERE transaction_id = $1
        OR ($2::text IS NOT NULL AND razorpay_payment_id = $2)
     ORDER BY created_at DESC
     LIMIT 1`,
    [transactionId, razorpayPaymentId ?? null],
  );
  const row = (existing as any).rows?.[0];
  if (row?.id && row.razorpay_payment_id) {
    if (razorpayPaymentId && row.razorpay_payment_id !== razorpayPaymentId) {
      await query(
        `UPDATE payments SET razorpay_payment_id = $2, payment_status = 'completed', updated_at = NOW()
         WHERE id = $1::uuid`,
        [row.id, razorpayPaymentId],
      );
    }
    return {
      id: String(row.id),
      amount: parseFloat(String(row.amount ?? '0')) || amount,
      razorpay_payment_id: String(razorpayPaymentId || row.razorpay_payment_id),
      payment_status: String(row.payment_status ?? 'completed'),
      customer_id: String(row.customer_id ?? customerId),
    };
  }

  const ins = await query(
    `INSERT INTO payments (
       booking_id, customer_id, vendor_id, amount, currency, payment_method, payment_status,
       razorpay_order_id, razorpay_payment_id, transaction_id, completed_at, created_at, updated_at
     ) VALUES (
       NULL, $1::uuid, $2::uuid, $3, 'INR', 'razorpay', $4,
       $5, $6, $7, CASE WHEN $4 = 'completed' THEN NOW() ELSE NULL END, NOW(), NOW()
     )
     RETURNING id::text, amount::text, razorpay_payment_id, payment_status, customer_id::text`,
    [
      customerId,
      vendorId,
      amount,
      input.paymentStatus === 'paid' || input.paymentStatus === 'completed' ? 'completed' : 'completed',
      razorpayOrderId ?? null,
      razorpayPaymentId ?? null,
      transactionId,
    ],
  );
  const created = (ins as any).rows?.[0];
  if (!created?.razorpay_payment_id) {
    throw new Error('Meal payment record missing Razorpay payment id');
  }
  return {
    id: String(created.id),
    amount: parseFloat(String(created.amount ?? '0')) || amount,
    razorpay_payment_id: String(created.razorpay_payment_id),
    payment_status: String(created.payment_status ?? 'completed'),
    customer_id: String(created.customer_id ?? customerId),
  };
}

async function creditMealWalletRefund(
  customerId: string,
  mealOrderId: string,
  amount: number,
  reason: string,
): Promise<number> {
  if (amount <= 0.009) return 0;
  const desc = `Refund: meal order [meal_order:${mealOrderId}] — ${reason}`;

  await withTransaction(async (client) => {
    const cwCols = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'customer_wallets'`,
    );
    const cwSet = new Set(cwCols.rows.map((r) => r.column_name));
    const cwHasCurrency = cwSet.has('currency');
    const cwHasUpdatedAt = cwSet.has('updated_at');

    const upsertCols = ['customer_id', 'balance'];
    const upsertVals: unknown[] = [customerId, 0];
    if (cwHasCurrency) {
      upsertCols.push('currency');
      upsertVals.push('INR');
    }
    const upsertPh = upsertVals.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO customer_wallets (${upsertCols.join(', ')})
       VALUES (${upsertPh})
       ON CONFLICT (customer_id) DO NOTHING`,
      upsertVals as unknown[],
    );

    await client.query(`SELECT id FROM customer_wallets WHERE customer_id = $1::uuid FOR UPDATE`, [
      customerId,
    ]);

    const walletRow = await client.query<{ id: string }>(
      `SELECT id::text AS id FROM customer_wallets WHERE customer_id = $1::uuid LIMIT 1`,
      [customerId],
    );
    const walletId = walletRow.rows[0]?.id;
    if (!walletId) throw new Error(`customer_wallets row not found for customer ${customerId}`);

    const txCols = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'wallet_transactions'`,
    );
    const txSet = new Set(txCols.rows.map((r) => r.column_name));
    const hasWalletId = txSet.has('wallet_id');
    const hasCustomerId = txSet.has('customer_id');
    const hasReferenceType = txSet.has('reference_type');
    const hasReferenceId = txSet.has('reference_id');
    const hasBalanceAfter = txSet.has('balance_after');

    if (hasWalletId && hasReferenceType && hasReferenceId) {
      const dup = await client.query(
        `SELECT id FROM wallet_transactions
         WHERE wallet_id = $1::uuid
           AND transaction_type = 'credit'
           AND reference_type = 'meal_refund'
           AND reference_id = $2::uuid
         LIMIT 1`,
        [walletId, mealOrderId],
      );
      if (dup.rows?.length) return;
    } else if (hasCustomerId) {
      const dup = await client.query(
        `SELECT id FROM wallet_transactions
         WHERE customer_id = $1::uuid
           AND transaction_type = 'credit'
           AND description = $2
         LIMIT 1`,
        [customerId, desc],
      );
      if (dup.rows?.length) return;
    }

    const setBal = cwHasUpdatedAt
      ? 'SET balance = balance + $1::numeric, updated_at = NOW()'
      : 'SET balance = balance + $1::numeric';
    const up = await client.query<{ balance: string }>(
      `UPDATE customer_wallets
       ${setBal}
       WHERE customer_id = $2::uuid
       RETURNING balance::text`,
      [amount, customerId],
    );
    if (!up.rows?.length) {
      throw new Error(`customer_wallets UPDATE matched no row for customer ${customerId}`);
    }
    const balanceAfter = parseFloat(String(up.rows[0]?.balance ?? '0')) || 0;

    const insertCols: string[] = [];
    const insertParams: unknown[] = [];
    if (hasWalletId) {
      insertCols.push('wallet_id');
      insertParams.push(walletId);
    }
    if (hasCustomerId) {
      insertCols.push('customer_id');
      insertParams.push(customerId);
    }
    insertCols.push('transaction_type');
    insertParams.push('credit');
    insertCols.push('amount');
    insertParams.push(amount);
    if (hasBalanceAfter) {
      insertCols.push('balance_after');
      insertParams.push(balanceAfter);
    }
    if (hasReferenceType) {
      insertCols.push('reference_type');
      insertParams.push('meal_refund');
    }
    if (hasReferenceId) {
      insertCols.push('reference_id');
      insertParams.push(mealOrderId);
    }
    insertCols.push('description');
    insertParams.push(desc);
    const ph = insertCols.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO wallet_transactions (${insertCols.join(', ')}) VALUES (${ph})`,
      insertParams as unknown[],
    );

    await client.query('SAVEPOINT sp_sync_customer_wallet_balance_meal');
    try {
      await client.query(
        `UPDATE customers SET wallet_balance = COALESCE(wallet_balance, 0) + $1::numeric WHERE id = $2::uuid`,
        [amount, customerId],
      );
      await client.query('RELEASE SAVEPOINT sp_sync_customer_wallet_balance_meal');
    } catch {
      await client.query('ROLLBACK TO SAVEPOINT sp_sync_customer_wallet_balance_meal');
    }
  });
  return amount;
}

let mealRefundCaseIdColumnExists: boolean | null = null;

async function refundsHasMealRefundCaseIdColumn(): Promise<boolean> {
  if (mealRefundCaseIdColumnExists !== null) return mealRefundCaseIdColumnExists;
  const res = await query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'refunds' AND column_name = 'meal_refund_case_id'
     LIMIT 1`,
  );
  mealRefundCaseIdColumnExists = Boolean((res as { rows?: unknown[] }).rows?.length);
  return mealRefundCaseIdColumnExists;
}

async function executeMealOriginalPaymentRefund(params: {
  transactionId: string;
  customerId: string;
  vendorId: string | null;
  totalPaid: number;
  walletPaid: number;
  refundAmount: number;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  reason: string;
  initiatedBy: RefundInitiator;
  mealOrderId?: string;
  mealRefundCaseId?: string;
  onSuccess?: () => Promise<void>;
}): Promise<OriginalPaymentRefundResult> {
  const {
    transactionId,
    customerId,
    vendorId,
    totalPaid,
    walletPaid,
    refundAmount,
    razorpayOrderId,
    razorpayPaymentId,
    reason,
    initiatedBy,
    mealOrderId,
    mealRefundCaseId,
    onSuccess,
  } = params;

  if (!customerId || refundAmount <= 0.009) {
    throw new Error('Invalid meal original-payment refund parameters');
  }

  const gatewayPaymentId = String(razorpayPaymentId || '').trim();
  const hasGatewayCapture = isLikelyRazorpayPaymentCaptureId(gatewayPaymentId);
  const walletOnly =
    gatewayPaymentId === 'wallet' || (!hasGatewayCapture && refundAmount > 0.009);

  if (!gatewayPaymentId || walletOnly) {
    if (walletPaid > 0.009 || gatewayPaymentId === 'wallet' || walletOnly) {
      const creditAmount = round2(refundAmount);
      const credited = await creditMealWalletRefund(
        customerId,
        mealOrderId || transactionId,
        creditAmount,
        reason,
      );
      if (onSuccess) await onSuccess();
      return {
        walletCredited: credited,
        razorpayAmount: 0,
        totalAmount: credited,
        status: 'wallet_only',
        message: `₹${credited.toFixed(2)} credited to Warmpawz wallet`,
      };
    }
    return {
      walletCredited: 0,
      razorpayAmount: 0,
      totalAmount: 0,
      status: 'skipped',
      message: 'No paid gateway capture found for meal refund',
    };
  }

  if (!hasGatewayCapture) {
    throw new Error('Meal payment record missing valid Razorpay payment id');
  }

  const payment = await ensureMealGatewayPaymentRecord({
    transactionId,
    customerId,
    vendorId,
    amount: totalPaid,
    razorpayOrderId,
    razorpayPaymentId,
    paymentStatus: 'paid',
  });

  const existing = await findActiveOriginalRefundForPayment(payment.id);
  if (existing && ['completed', 'processing', 'approved', 'processed'].includes(existing.refund_status)) {
    return {
      walletCredited: 0,
      razorpayAmount: 0,
      totalAmount: refundAmount,
      status: 'skipped',
      message: 'Refund already initiated for this meal payment',
      refundId: existing.id,
      alreadyProcessed: true,
    };
  }

  const gatewayPaid = round2(Math.max(0, totalPaid - walletPaid));
  const { walletSlice, gatewaySlice } = splitRefundAmount(refundAmount, walletPaid, gatewayPaid);

  let walletCredited = 0;
  if (walletSlice > 0.009) {
    walletCredited = await creditMealWalletRefund(
      customerId,
      mealOrderId || transactionId,
      walletSlice,
      reason,
    );
  }

  const alreadyRefunded = await sumProcessedRefundsForPayment(payment.id);
  const availableOnPayment = round2(payment.amount - alreadyRefunded);
  const razorpayAmount = round2(Math.min(gatewaySlice, availableOnPayment));

  if (razorpayAmount <= 0.009) {
    if (walletCredited > 0.009) {
      if (onSuccess) await onSuccess();
      return {
        walletCredited,
        razorpayAmount: 0,
        totalAmount: walletCredited,
        status: 'wallet_only',
        message: `₹${walletCredited.toFixed(2)} credited to wallet`,
      };
    }
    return {
      walletCredited: 0,
      razorpayAmount: 0,
      totalAmount: 0,
      status: 'skipped',
      message: 'No refundable gateway balance remaining',
    };
  }

  const rzResult = await callRazorpayRefund(payment.razorpay_payment_id, razorpayAmount, {
    reason,
    initiated_by: initiatedBy,
    ...(mealOrderId ? { meal_order_id: mealOrderId } : {}),
    transaction_id: transactionId,
  });
  const razorpayRefundId = rzResult.id;
  const finalStatus = rzResult.status === 'processed' ? 'completed' : 'processing';
  const refundStatusDb = finalStatus === 'completed' ? 'completed' : 'processing';
  const isFullPaymentRefund = round2(alreadyRefunded + razorpayAmount) >= payment.amount - 0.01;
  const newPaymentStatus = isFullPaymentRefund ? 'refunded' : 'partially_refunded';

  let refundId: string | undefined;
  const linkMealCase =
    mealRefundCaseId && (await refundsHasMealRefundCaseIdColumn());
  await withTransaction(async (client) => {
    const ins = linkMealCase
      ? await client.query(
          `INSERT INTO refunds (
             payment_id, booking_id, customer_id, vendor_id, refund_amount, refund_reason,
             refund_status, refund_method, razorpay_refund_id, meal_refund_case_id,
             requested_at, processed_at
           ) VALUES ($1::uuid, NULL, $2::uuid, $3::uuid, $4, $5, $6, 'original', $7, $8::uuid, NOW(), NOW())
           RETURNING id::text`,
          [
            payment.id,
            customerId,
            vendorId,
            razorpayAmount,
            reason,
            refundStatusDb,
            razorpayRefundId || null,
            mealRefundCaseId,
          ],
        )
      : await client.query(
          `INSERT INTO refunds (
             payment_id, booking_id, customer_id, vendor_id, refund_amount, refund_reason,
             refund_status, refund_method, razorpay_refund_id, requested_at, processed_at
           ) VALUES ($1::uuid, NULL, $2::uuid, $3::uuid, $4, $5, $6, 'original', $7, NOW(), NOW())
           RETURNING id::text`,
          [
            payment.id,
            customerId,
            vendorId,
            razorpayAmount,
            reason,
            refundStatusDb,
            razorpayRefundId || null,
          ],
        );
    refundId = ins.rows[0]?.id;
    await client.query(`UPDATE payments SET payment_status = $1, updated_at = NOW() WHERE id = $2::uuid`, [
      newPaymentStatus,
      payment.id,
    ]);
  });

  if (onSuccess) await onSuccess();

  const totalReturned = round2(walletCredited + razorpayAmount);
  const messageParts: string[] = [];
  if (walletCredited > 0.009) messageParts.push(`₹${walletCredited.toFixed(2)} credited to wallet`);
  if (razorpayAmount > 0.009) {
    messageParts.push(
      `₹${razorpayAmount.toFixed(2)} refund to original payment method (typically 5–7 business days)`,
    );
  }

  if (refundId) {
    const refundRowId = refundId;
    setImmediate(async () => {
      try {
        const { sendRefundNotification } = await import('./refund-service');
        await sendRefundNotification({
          customerId,
          bookingId: mealOrderId,
          amount: totalReturned,
          reason,
          refundId: refundRowId,
        });
      } catch (e) {
        console.error('[meal-order-original-refund] notification failed:', e);
      }
    });
  }

  return {
    refundId,
    razorpayRefundId,
    walletCredited,
    razorpayAmount,
    totalAmount: totalReturned,
    status: finalStatus,
    message: messageParts.join('; ') || 'Refund initiated',
  };
}

/** Admin-approved meal logistics refund — custom amount, optional case linkage. */
export async function processMealOrderAdminOriginalRefund(
  mealOrderId: string,
  refundAmount: number,
  reason: string,
  options: { mealRefundCaseId?: string; initiatedBy?: RefundInitiator } = {},
): Promise<OriginalPaymentRefundResult> {
  const amount = round2(refundAmount);
  if (amount <= 0.009) {
    return {
      walletCredited: 0,
      razorpayAmount: 0,
      totalAmount: 0,
      status: 'skipped',
      message: 'No refundable amount',
    };
  }

  const res = await query(
    `SELECT id, customer_id, vendor_id, total_amount::text, payment_status,
            razorpay_payment_id, razorpay_order_id, purchase_snapshot
     FROM meal_orders WHERE id = $1::uuid LIMIT 1`,
    [mealOrderId],
  );
  const order = (res as any).rows?.[0] as
    | {
        id: string;
        customer_id: string;
        vendor_id: string;
        total_amount: string;
        payment_status: string;
        razorpay_payment_id?: string;
        razorpay_order_id?: string;
        purchase_snapshot?: unknown;
      }
    | undefined;

  if (!order) throw new Error('Meal order not found');
  if (order.payment_status === 'refunded') {
    return {
      walletCredited: 0,
      razorpayAmount: 0,
      totalAmount: 0,
      status: 'skipped',
      message: 'Order already refunded',
      alreadyProcessed: true,
    };
  }
  if (order.payment_status !== 'paid' && order.payment_status !== 'completed') {
    return {
      walletCredited: 0,
      razorpayAmount: 0,
      totalAmount: 0,
      status: 'skipped',
      message: 'Order was not paid — no refund required',
    };
  }

  const orderTotal = round2(parseFloat(order.total_amount) || 0);
  const cappedAmount = round2(Math.min(amount, orderTotal > 0 ? orderTotal : amount));

  let walletPaid = await resolveMealOrderWalletPaidInr(
    mealOrderId,
    String(order.customer_id),
    order.purchase_snapshot,
  );
  if (walletPaid <= 0.009) {
    walletPaid = mealOrderWalletDebitFromRow({ purchase_snapshot: order.purchase_snapshot });
  }
  const gatewayId = String(order.razorpay_payment_id || '').trim();
  if (walletPaid <= 0.009 && gatewayId === 'wallet') {
    walletPaid = cappedAmount;
  }
  if (
    walletPaid <= 0.009 &&
    !isLikelyRazorpayPaymentCaptureId(gatewayId) &&
    gatewayId !== 'wallet'
  ) {
    walletPaid = cappedAmount;
  }

  return executeMealOriginalPaymentRefund({
    transactionId: `meal_order:${mealOrderId}`,
    customerId: String(order.customer_id),
    vendorId: order.vendor_id ? String(order.vendor_id) : null,
    totalPaid: orderTotal || cappedAmount,
    walletPaid,
    refundAmount: cappedAmount,
    razorpayOrderId: order.razorpay_order_id,
    razorpayPaymentId: order.razorpay_payment_id,
    reason,
    initiatedBy: options.initiatedBy ?? 'admin',
    mealOrderId,
    mealRefundCaseId: options.mealRefundCaseId,
    onSuccess: async () => {
      if (cappedAmount >= (orderTotal || cappedAmount) - 0.01) {
        await query(
          `UPDATE meal_orders SET payment_status = 'refunded', updated_at = NOW() WHERE id = $1::uuid`,
          [mealOrderId],
        );
      }
    },
  });
}

/** Vendor/customer cancel — one-time (adhoc) paid meal order → original payment refund. */
export async function processMealOrderVendorCancelOriginalRefund(
  mealOrderId: string,
  reason: string,
  initiatedBy: RefundInitiator = 'vendor',
): Promise<OriginalPaymentRefundResult> {
  const res = await query(
    `SELECT id, customer_id, vendor_id, total_amount::text, payment_status,
            razorpay_payment_id, razorpay_order_id, subscription_id, order_type,
            purchase_snapshot
     FROM meal_orders WHERE id = $1::uuid LIMIT 1`,
    [mealOrderId],
  );
  const order = (res as any).rows?.[0] as
    | {
        id: string;
        customer_id: string;
        vendor_id: string;
        total_amount: string;
        payment_status: string;
        razorpay_payment_id?: string;
        razorpay_order_id?: string;
        subscription_id?: string;
        order_type?: string;
        purchase_snapshot?: unknown;
      }
    | undefined;

  if (!order) throw new Error('Meal order not found');
  if (order.payment_status !== 'paid') {
    return {
      walletCredited: 0,
      razorpayAmount: 0,
      totalAmount: 0,
      status: 'skipped',
      message: 'Order was not paid — no refund required',
    };
  }

  const snap = parsePricingSnapshot(order.purchase_snapshot);
  const subscriptionRole = String(snap.subscriptionVendorBookingRole || '').toLowerCase();
  if (order.subscription_id && subscriptionRole === 'session') {
    const deliveryId = String(snap.canonicalDeliveryId || '').trim();
    const sessionNumber = Math.max(1, Number(snap.sessionNumber) || 1);
    if (deliveryId) {
      return processMealSubscriptionSessionVendorCancelOriginalRefund(
        String(order.subscription_id),
        deliveryId,
        sessionNumber,
        reason,
      );
    }
  }

  const refundAmount = round2(parseFloat(order.total_amount) || 0);
  if (refundAmount <= 0.009) {
    return {
      walletCredited: 0,
      razorpayAmount: 0,
      totalAmount: 0,
      status: 'skipped',
      message: 'No refundable amount on meal order',
    };
  }

  let walletPaid = await resolveMealOrderWalletPaidInr(
    mealOrderId,
    String(order.customer_id),
    order.purchase_snapshot,
  );
  if (walletPaid <= 0.009) {
    walletPaid = mealOrderWalletDebitFromRow({ purchase_snapshot: order.purchase_snapshot });
  }
  const gatewayId = String(order.razorpay_payment_id || '').trim();
  if (walletPaid <= 0.009 && gatewayId === 'wallet') {
    walletPaid = refundAmount;
  }
  if (
    walletPaid <= 0.009 &&
    !isLikelyRazorpayPaymentCaptureId(gatewayId) &&
    gatewayId !== 'wallet'
  ) {
    // Paid order with no gateway capture id — treat as wallet-settled (ledger/snapshot gap).
    walletPaid = refundAmount;
  }

  return executeMealOriginalPaymentRefund({
    transactionId: `meal_order:${mealOrderId}`,
    customerId: String(order.customer_id),
    vendorId: order.vendor_id ? String(order.vendor_id) : null,
    totalPaid: refundAmount,
    walletPaid,
    refundAmount,
    razorpayOrderId: order.razorpay_order_id,
    razorpayPaymentId: order.razorpay_payment_id,
    reason,
    initiatedBy,
    mealOrderId,
    onSuccess: async () => {
      await query(
        `UPDATE meal_orders SET payment_status = 'refunded', updated_at = NOW() WHERE id = $1::uuid`,
        [mealOrderId],
      );
    },
  });
}

function parsePricingSnapshot(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

/** Vendor rejects subscription parent booking — refund to original payment (platform fee may be withheld). */
export async function processMealSubscriptionParentVendorCancelOriginalRefund(
  subscriptionId: string,
  cancelReason: string,
): Promise<OriginalPaymentRefundResult & { platformFeeRetainedInr?: number }> {
  const payRes = await query(
    `SELECT id, amount::text, provider_payment_id, provider,
            COALESCE(metadata->>'wallet_debit_inr', '0') AS wallet_debit_inr,
            COALESCE(metadata->>'vendor_parent_booking_full_refund_at', '') AS refund_done_at
     FROM meal_subscription_payments
     WHERE subscription_id = $1::uuid AND status = 'paid'
     ORDER BY created_at DESC LIMIT 1`,
    [subscriptionId],
  );
  const pay = (payRes as any).rows?.[0] as
    | {
        id: string;
        amount: string;
        provider_payment_id?: string;
        wallet_debit_inr: string;
        refund_done_at: string;
      }
    | undefined;

  if (!pay) {
    return {
      walletCredited: 0,
      razorpayAmount: 0,
      totalAmount: 0,
      status: 'skipped',
      message: 'No paid payment row found for subscription',
    };
  }
  if (pay.refund_done_at) {
    return {
      walletCredited: 0,
      razorpayAmount: 0,
      totalAmount: 0,
      status: 'skipped',
      message: 'Subscription booking refund already processed',
      alreadyProcessed: true,
    };
  }

  const subRes = await query(
    `SELECT id, customer_id, vendor_id, pricing_snapshot FROM meal_subscriptions WHERE id = $1 LIMIT 1`,
    [subscriptionId],
  );
  const sub = (subRes as any).rows?.[0] as
    | { id: string; customer_id: string; vendor_id: string; pricing_snapshot?: unknown }
    | undefined;
  if (!sub) throw new Error('Subscription not found');

  const totalPaid = round2(parseFloat(pay.amount) || 0);
  const walletPaid = round2(parseFloat(pay.wallet_debit_inr) || 0);
  const snap = parsePricingSnapshot(sub.pricing_snapshot);
  const platformFeeUpfront = Number(snap.platformFeeUpfront ?? snap.platform_fee_upfront ?? 0) || 0;
  const platformFeeWithheld = round2(Math.min(Math.max(0, platformFeeUpfront), totalPaid));
  const refundableToCustomer = round2(Math.max(0, totalPaid - platformFeeWithheld));

  const result = await executeMealOriginalPaymentRefund({
    transactionId: `meal_subscription:${subscriptionId}`,
    customerId: String(sub.customer_id),
    vendorId: sub.vendor_id ? String(sub.vendor_id) : null,
    totalPaid,
    walletPaid,
    refundAmount: refundableToCustomer,
    razorpayPaymentId: pay.provider_payment_id,
    reason: cancelReason,
    initiatedBy: 'vendor',
    onSuccess: async () => {
      await query(
        `UPDATE meal_subscription_payments
         SET status = 'refunded',
             metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
               'vendor_parent_booking_full_refund_at', NOW()::text,
               'vendor_parent_booking_refund_customer_inr', $2::text,
               'vendor_parent_booking_platform_fee_withheld_inr', $3::text,
               'vendor_parent_booking_refund_reason', $4
             ),
             updated_at = NOW()
         WHERE id = $1::uuid`,
        [pay.id, String(refundableToCustomer), String(platformFeeWithheld), cancelReason],
      );
      await query(
        `UPDATE meal_subscriptions SET lifecycle_status = 'cancelled', status = 'cancelled', updated_at = NOW()
         WHERE id = $1::uuid`,
        [subscriptionId],
      );
      await query(
        `UPDATE meal_subscription_deliveries SET status = 'cancelled', updated_at = NOW()
         WHERE subscription_id = $1::uuid AND status NOT IN ('delivered', 'cancelled', 'skipped')`,
        [subscriptionId],
      );
      await query(
        `UPDATE meal_orders SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, NOW()), updated_at = NOW()
         WHERE subscription_id = $1::uuid AND status NOT IN ('delivered', 'cancelled')`,
        [subscriptionId],
      );
    },
  });

  return { ...result, platformFeeRetainedInr: platformFeeWithheld };
}

/** Vendor cancels first subscription session — proportional original-payment refund. */
export async function processMealSubscriptionSessionVendorCancelOriginalRefund(
  subscriptionId: string,
  deliveryId: string,
  sessionNumber: number,
  cancelReason: string,
): Promise<OriginalPaymentRefundResult> {
  const existCheck = await query(`SELECT metadata FROM meal_subscription_deliveries WHERE id = $1 LIMIT 1`, [
    deliveryId,
  ]);
  const existMeta = ((existCheck as any).rows?.[0]?.metadata || {}) as Record<string, unknown>;
  if (existMeta.refund_processed) {
    return {
      walletCredited: 0,
      razorpayAmount: 0,
      totalAmount: 0,
      status: 'skipped',
      message: 'Refund already processed for this session',
      alreadyProcessed: true,
    };
  }

  const subRes = await query(
    `SELECT id, customer_id, vendor_id, total_sessions FROM meal_subscriptions WHERE id = $1 LIMIT 1`,
    [subscriptionId],
  );
  const sub = (subRes as any).rows?.[0] as
    | { id: string; customer_id: string; vendor_id: string; total_sessions: number | string }
    | undefined;
  if (!sub) throw new Error('Subscription not found');

  const payRes = await query(
    `SELECT id, amount::text, provider_payment_id,
            COALESCE(metadata->>'wallet_debit_inr', '0') AS wallet_debit_inr
     FROM meal_subscription_payments
     WHERE subscription_id = $1::uuid AND status = 'paid'
     ORDER BY created_at DESC LIMIT 1`,
    [subscriptionId],
  );
  const pay = (payRes as any).rows?.[0] as
    | { amount: string; provider_payment_id?: string; wallet_debit_inr: string }
    | undefined;
  if (!pay) {
    return {
      walletCredited: 0,
      razorpayAmount: 0,
      totalAmount: 0,
      status: 'skipped',
      message: 'No paid payment row found for subscription',
    };
  }

  const totalPaid = parseFloat(pay.amount) || 0;
  const walletPaidTotal = parseFloat(pay.wallet_debit_inr) || 0;
  const totalSessions = Math.max(1, Number(sub.total_sessions) || 1);
  const perSessionTotal = round2(totalPaid / totalSessions);
  const walletShare = totalPaid > 0 ? walletPaidTotal / totalPaid : 0;
  const perSessionWallet = round2(perSessionTotal * walletShare);

  return executeMealOriginalPaymentRefund({
    transactionId: `meal_subscription_session:${deliveryId}`,
    customerId: String(sub.customer_id),
    vendorId: sub.vendor_id ? String(sub.vendor_id) : null,
    totalPaid: perSessionTotal,
    walletPaid: perSessionWallet,
    refundAmount: perSessionTotal,
    razorpayPaymentId: pay.provider_payment_id,
    reason: cancelReason,
    initiatedBy: 'vendor',
    onSuccess: async () => {
      await query(
        `UPDATE meal_subscription_deliveries
         SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'refund_processed', true,
           'refund_amount_inr', $2::text,
           'refund_reason', $3,
           'refund_at', $4
         ),
         updated_at = NOW()
         WHERE id = $1`,
        [deliveryId, String(perSessionTotal), cancelReason, new Date().toISOString()],
      );
    },
  });
}
