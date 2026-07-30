/**
 * Shop (ecommerce) payment reconciliation — mirrors booking payment-reconciliation.ts.
 * Confirms paid Razorpay captures as placed orders; re-confirms hold-expiry cancels when paid.
 */

import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../database/rds-connection';
import { isPaymentAbandonCancellationReason } from '../shop-vendor-visibility';
import { notifyShopOrderPaid } from '../shop-order-notifications';
import { triggerAutoShipment } from '../logistics/trigger-auto-shipment';
import { applyOrderCommissionAudit } from '../resolve-ecommerce-commission-rate';
import { writeEcommerceOrderSettlementLedgerRow } from '../write-ecommerce-order-settlement';

export const SHOP_HOLD_EXPIRY_CANCEL_REASON = 'payment_window_expired';

export interface ConfirmShopOrderPaidResult {
  confirmed: boolean;
  orderId: string;
  alreadyPaid: boolean;
  reconfirmedFromHoldCancel: boolean;
  vendorId: string | null;
  paymentId: string | null;
}

export interface ReconcilePendingShopPaymentsResult {
  reconciledCount: number;
  orderIds: string[];
  razorpayChecks: number;
}

function isShopOrderPaidStatus(ps: string | null | undefined): boolean {
  const s = String(ps || '').toLowerCase();
  return s === 'paid' || s === 'completed';
}

function canReconfirmShopOrderFromHoldCancel(row: {
  order_status?: string | null;
  cancellation_reason?: string | null;
}): boolean {
  const st = String(row.order_status || '').toLowerCase();
  if (st !== 'cancelled') return false;
  return isPaymentAbandonCancellationReason(row.cancellation_reason);
}

/** Post-commit side effects after shop order is marked paid (idempotent). */
export async function runShopOrderPaidSideEffects(
  orderId: string,
  vendorId: string | null,
  logPrefix = '[SHOP-PAID]'
): Promise<void> {
  triggerAutoShipment(orderId, 'ecommerce').catch((e) =>
    console.error(`${logPrefix} Auto-shipment trigger failed:`, e)
  );

  const writeSettlement = () =>
    writeEcommerceOrderSettlementLedgerRow(orderId).catch((e) =>
      console.error(`${logPrefix} Settlement ledger write failed:`, e)
    );

  if (vendorId) {
    void applyOrderCommissionAudit(orderId, vendorId)
      .then(() => writeSettlement())
      .catch((e) => {
        console.warn(`${logPrefix} Commission audit failed (settlement still attempted):`, e);
        return writeSettlement();
      });
  } else {
    void writeSettlement();
  }

  void notifyShopOrderPaid(orderId).catch((e) =>
    console.error(`${logPrefix} Shop order notification failed:`, e)
  );
}

/**
 * Idempotent: mark shop order paid + placed from a Razorpay capture.
 * Re-confirms orders auto-cancelled for payment_window_expired when payment was captured.
 */
export async function confirmShopOrderPaidFromCapture(params: {
  orderId: string;
  razorpayPaymentId?: string | null;
  razorpayOrderId?: string | null;
  paymentRowId?: string | null;
  resolvedPaymentMethod?: string | null;
  source?: string;
}): Promise<ConfirmShopOrderPaidResult> {
  const orderId = String(params.orderId);
  const source = params.source || 'capture';
  let confirmed = false;
  let alreadyPaid = false;
  let reconfirmedFromHoldCancel = false;
  let vendorId: string | null = null;
  let paymentId: string | null = params.paymentRowId ? String(params.paymentRowId) : null;

  const resolvedPaymentMethod =
    params.resolvedPaymentMethod && String(params.resolvedPaymentMethod) !== 'razorpay'
      ? String(params.resolvedPaymentMethod)
      : 'online';

  await withTransaction(async (client: PoolClient) => {
    let paymentRow: Record<string, unknown> | null = null;

    if (params.paymentRowId) {
      const { rows } = await client.query(
        `SELECT * FROM payments WHERE id = $1::uuid FOR UPDATE`,
        [params.paymentRowId]
      );
      paymentRow = rows[0] ?? null;
    } else if (params.razorpayOrderId) {
      const { rows } = await client.query(
        `SELECT * FROM payments WHERE razorpay_order_id = $1 FOR UPDATE`,
        [params.razorpayOrderId]
      );
      paymentRow = rows[0] ?? null;
    } else if (params.razorpayPaymentId) {
      const { rows } = await client.query(
        `SELECT * FROM payments WHERE razorpay_payment_id = $1 FOR UPDATE`,
        [params.razorpayPaymentId]
      );
      if (rows.length === 0 && params.razorpayOrderId) {
        const fallback = await client.query(
          `SELECT * FROM payments WHERE razorpay_order_id = $1 FOR UPDATE`,
          [params.razorpayOrderId]
        );
        paymentRow = fallback.rows[0] ?? null;
      } else {
        paymentRow = rows[0] ?? null;
      }
    }

    if (!paymentRow) {
      const { rows } = await client.query(
        `SELECT * FROM payments WHERE order_id = $1::uuid AND booking_id IS NULL AND pharmacy_order_id IS NULL
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [orderId]
      );
      paymentRow = rows[0] ?? null;
    }

    if (!paymentRow || !paymentRow.order_id) {
      return;
    }

    paymentId = String(paymentRow.id);

    const { rows: shopRows } = await client.query(
      `SELECT id, order_status, payment_status, payment_method, cancellation_reason, vendor_id
       FROM orders WHERE id = $1::uuid FOR UPDATE`,
      [orderId]
    );
    if (shopRows.length === 0) return;

    const shopRow = shopRows[0];
    const shopSt = String(shopRow.order_status || '').toLowerCase();
    const shopPs = String(shopRow.payment_status || '').toLowerCase();

    if (shopSt === 'returned' || shopSt === 'delivered') return;

    if (isShopOrderPaidStatus(shopPs) && shopSt !== 'cancelled') {
      alreadyPaid = true;
      vendorId = shopRow.vendor_id ? String(shopRow.vendor_id) : null;
      return;
    }

    const holdCancelReconfirm = canReconfirmShopOrderFromHoldCancel(shopRow);
    if (shopSt === 'cancelled' && !holdCancelReconfirm) {
      return;
    }

    if (shopSt !== 'pending_payment' && shopSt !== 'pending' && !holdCancelReconfirm) {
      return;
    }

    const rzpPayId = params.razorpayPaymentId
      ? String(params.razorpayPaymentId)
      : paymentRow.razorpay_payment_id
        ? String(paymentRow.razorpay_payment_id)
        : null;

    await client.query(
      `UPDATE payments SET
         payment_status = 'completed',
         razorpay_payment_id = COALESCE($1, razorpay_payment_id),
         razorpay_order_id = COALESCE(razorpay_order_id, $2),
         completed_at = COALESCE(completed_at, NOW()),
         updated_at = NOW()
       WHERE id = $3::uuid`,
      [rzpPayId, params.razorpayOrderId || paymentRow.razorpay_order_id || null, paymentId]
    );

    await client.query(
      `UPDATE orders SET
         payment_status = 'paid',
         order_status = CASE
           WHEN order_status IN ('pending_payment', 'pending') THEN 'pending'
           WHEN order_status = 'cancelled'
             AND COALESCE(cancellation_reason, '') = $1
           THEN 'pending'
           ELSE order_status
         END,
         payment_method = COALESCE($2, payment_method),
         payment_id = COALESCE(payment_id, $3::uuid),
         payment_hold_expires_at = NULL,
         cancellation_reason = CASE
           WHEN order_status = 'cancelled'
             AND COALESCE(cancellation_reason, '') = $1
           THEN NULL
           ELSE cancellation_reason
         END,
         cancelled_at = CASE
           WHEN order_status = 'cancelled'
             AND COALESCE(cancellation_reason, '') = $1
           THEN NULL
           ELSE cancelled_at
         END,
         cancelled_by = CASE
           WHEN order_status = 'cancelled'
             AND COALESCE(cancellation_reason, '') = $1
           THEN NULL
           ELSE cancelled_by
         END,
         updated_at = NOW()
       WHERE id = $4::uuid`,
      [SHOP_HOLD_EXPIRY_CANCEL_REASON, resolvedPaymentMethod, paymentId, orderId]
    );

    confirmed = true;
    reconfirmedFromHoldCancel = holdCancelReconfirm;
    vendorId = shopRow.vendor_id ? String(shopRow.vendor_id) : null;
  });

  if (confirmed && !alreadyPaid) {
    await runShopOrderPaidSideEffects(orderId, vendorId, `[SHOP-RECONCILE:${source}]`);
  }

  return {
    confirmed,
    orderId,
    alreadyPaid,
    reconfirmedFromHoldCancel,
    vendorId,
    paymentId,
  };
}

async function reconcileShopOrderTier1(orderId: string, source: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT o.id, o.order_status, o.payment_status, o.cancellation_reason
     FROM orders o
     WHERE o.id = $1::uuid
       AND LOWER(COALESCE(o.order_type, 'ecommerce')) IN ('ecommerce', 'shop', 'shop_order')
     LIMIT 1`,
    [orderId]
  );
  if (rows.length === 0) return false;

  const order = rows[0];
  if (isShopOrderPaidStatus(order.payment_status) && String(order.order_status) !== 'cancelled') {
    return false;
  }

  const { rows: payRows } = await query(
    `SELECT id, razorpay_payment_id, razorpay_order_id
     FROM payments
     WHERE order_id = $1::uuid
       AND booking_id IS NULL
       AND pharmacy_order_id IS NULL
       AND LOWER(COALESCE(payment_status, '')) = 'completed'
     ORDER BY created_at DESC
     LIMIT 1`,
    [orderId]
  );
  if (payRows.length === 0) return false;

  const pay = payRows[0];
  const result = await confirmShopOrderPaidFromCapture({
    orderId,
    paymentRowId: String(pay.id),
    razorpayPaymentId: pay.razorpay_payment_id ? String(pay.razorpay_payment_id) : null,
    razorpayOrderId: pay.razorpay_order_id ? String(pay.razorpay_order_id) : null,
    source: `${source}-T1`,
  });
  return result.confirmed || result.alreadyPaid;
}

async function reconcileShopOrderTier2(
  orderId: string,
  source: string
): Promise<{ reconciled: boolean; razorpayChecks: number }> {
  const { rows: payRows } = await query(
    `SELECT p.id, p.razorpay_order_id, p.razorpay_payment_id
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE p.order_id = $1::uuid
       AND p.booking_id IS NULL
       AND p.pharmacy_order_id IS NULL
       AND p.razorpay_order_id IS NOT NULL
       AND LOWER(COALESCE(p.payment_status, '')) IN ('pending', 'failed')
       AND LOWER(COALESCE(o.payment_status, '')) NOT IN ('paid', 'completed', 'refunded')
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [orderId]
  );
  if (payRows.length === 0) {
    return { reconciled: false, razorpayChecks: 0 };
  }

  const payment = payRows[0];
  const { razorpayRequest } = await import('./razorpay-client');

  const rzpOrder = await razorpayRequest(
    `/orders/${payment.razorpay_order_id}`,
    'GET',
    undefined,
    5000
  );

  if (rzpOrder?.status !== 'paid') {
    return { reconciled: false, razorpayChecks: 1 };
  }

  let razorpayPaymentId = payment.razorpay_payment_id
    ? String(payment.razorpay_payment_id)
    : null;

  if (!razorpayPaymentId) {
    try {
      const rzpPayments = await razorpayRequest(
        `/orders/${payment.razorpay_order_id}/payments`,
        'GET',
        undefined,
        5000
      );
      const capturedPayment = rzpPayments?.items?.find(
        (p: { status?: string }) => p.status === 'captured'
      );
      if (capturedPayment?.id) {
        razorpayPaymentId = String(capturedPayment.id);
      }
    } catch {
      /* non-fatal */
    }
  }

  const result = await confirmShopOrderPaidFromCapture({
    orderId,
    paymentRowId: String(payment.id),
    razorpayOrderId: String(payment.razorpay_order_id),
    razorpayPaymentId,
    source: `${source}-T2`,
  });

  return {
    reconciled: result.confirmed || result.alreadyPaid,
    razorpayChecks: 1,
  };
}

/** Reconcile a single shop order (Tier 1 then Tier 2). */
export async function reconcileShopOrderPayment(
  orderId: string,
  options?: { source?: string }
): Promise<boolean> {
  const source = options?.source || 'shop-reconcile';
  if (await reconcileShopOrderTier1(orderId, source)) return true;
  const t2 = await reconcileShopOrderTier2(orderId, source);
  return t2.reconciled;
}

/**
 * Batch reconcile pending shop payments before hold expiry sweeps.
 * Tier 1: completed payment row but unpaid/cancelled-hold order.
 * Tier 2: Razorpay API check for pending payment rows (capped).
 */
export async function reconcilePendingShopPayments(options?: {
  customerId?: string;
  orderIds?: string[];
  limit?: number;
  razorpayCheckLimit?: number;
  source?: string;
}): Promise<ReconcilePendingShopPaymentsResult> {
  const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
  const razorpayCheckLimit = Math.min(Math.max(options?.razorpayCheckLimit ?? 5, 1), 10);
  const source = options?.source || 'batch';
  const reconciledOrderIds: string[] = [];
  let razorpayChecks = 0;

  if (options?.orderIds?.length) {
    for (const rawId of options.orderIds.slice(0, limit)) {
      const orderId = String(rawId);
      if (await reconcileShopOrderTier1(orderId, source)) {
        reconciledOrderIds.push(orderId);
        continue;
      }
      if (razorpayChecks < razorpayCheckLimit) {
        const t2 = await reconcileShopOrderTier2(orderId, source);
        razorpayChecks += t2.razorpayChecks;
        if (t2.reconciled) reconciledOrderIds.push(orderId);
      }
    }
    return {
      reconciledCount: reconciledOrderIds.length,
      orderIds: reconciledOrderIds,
      razorpayChecks,
    };
  }

  const params: unknown[] = [];
  let customerFilter = '';
  let reasonParam = '$1';
  let limitParam = '$2';
  if (options?.customerId) {
    customerFilter = `AND o.customer_id = $1::uuid`;
    params.push(options.customerId);
    reasonParam = '$2';
    limitParam = '$3';
  }
  params.push(SHOP_HOLD_EXPIRY_CANCEL_REASON, limit);

  const { rows: tier1Candidates } = await query(
    `SELECT DISTINCT o.id::text AS order_id
     FROM orders o
     JOIN payments p ON p.order_id = o.id
     WHERE LOWER(COALESCE(o.order_type, 'ecommerce')) IN ('ecommerce', 'shop', 'shop_order')
       AND p.booking_id IS NULL
       AND p.pharmacy_order_id IS NULL
       AND LOWER(COALESCE(p.payment_status, '')) = 'completed'
       AND (
         LOWER(COALESCE(o.payment_status, '')) NOT IN ('paid', 'completed')
         OR (
           o.order_status = 'cancelled'
           AND COALESCE(o.cancellation_reason, '') = ${reasonParam}
         )
       )
       ${customerFilter}
     ORDER BY o.id
     LIMIT ${limitParam}`,
    params
  );

  for (const row of tier1Candidates) {
    const orderId = String(row.order_id);
    if (await reconcileShopOrderTier1(orderId, source)) {
      reconciledOrderIds.push(orderId);
    }
  }

  if (razorpayChecks < razorpayCheckLimit) {
    const t2Params: unknown[] = options?.customerId ? [options.customerId] : [];
    const t2CustomerFilter = options?.customerId ? `AND o.customer_id = $1::uuid` : '';
    const t2LimitParam = options?.customerId ? '$2' : '$1';
    t2Params.push(razorpayCheckLimit);

    const { rows: tier2Candidates } = await query(
      `SELECT DISTINCT o.id::text AS order_id, p.id::text AS payment_id, p.razorpay_order_id
       FROM orders o
       JOIN payments p ON p.order_id = o.id
       WHERE LOWER(COALESCE(o.order_type, 'ecommerce')) IN ('ecommerce', 'shop', 'shop_order')
         AND p.booking_id IS NULL
         AND p.pharmacy_order_id IS NULL
         AND p.razorpay_order_id IS NOT NULL
         AND LOWER(COALESCE(p.payment_status, '')) IN ('pending', 'failed')
         AND LOWER(COALESCE(o.order_status, '')) IN ('pending_payment', 'pending', 'cancelled')
         AND LOWER(COALESCE(o.payment_status, '')) NOT IN ('paid', 'completed', 'refunded')
         ${t2CustomerFilter}
       ORDER BY o.created_at ASC
       LIMIT ${t2LimitParam}`,
      t2Params
    );

    for (const row of tier2Candidates) {
      if (razorpayChecks >= razorpayCheckLimit) break;
      const orderId = String(row.order_id);
      if (reconciledOrderIds.includes(orderId)) continue;
      const t2 = await reconcileShopOrderTier2(orderId, source);
      razorpayChecks += t2.razorpayChecks;
      if (t2.reconciled) reconciledOrderIds.push(orderId);
    }
  }

  return {
    reconciledCount: reconciledOrderIds.length,
    orderIds: reconciledOrderIds,
    razorpayChecks,
  };
}
