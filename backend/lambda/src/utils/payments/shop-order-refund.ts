/**
 * Shop (ecommerce) order cancel + Razorpay refund orchestrator.
 * Single-lock, minimal-fetch, idempotent money moves.
 */

import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../database/rds-connection';
import { getRazorpayClient } from './razorpay-client';
import { incrementSkuStock } from '../product-sku-order';
import { discardUnpaidShopOrder } from '../shop-payment-hold';

export type ShopCancelledBy = 'pet_parent' | 'provider' | 'system';

export type ShopRefundStatus =
  | 'none'
  | 'skipped'
  | 'pending_retry'
  | 'processing'
  | 'completed';

export interface CancelPaidShopOrderInput {
  orderId: string;
  reason?: string;
  cancelledBy: ShopCancelledBy;
  /** When set, order must belong to this customer (404 if not). */
  customerId?: string;
  /** When set, order must belong to this vendor (404 if not). */
  vendorId?: string;
  /** Statuses allowed for cancel; default pending + confirmed. */
  allowedStatuses?: string[];
}

export interface CancelPaidShopOrderResult {
  success: boolean;
  orderId: string;
  status: string;
  cancelledBy: ShopCancelledBy | null;
  refundStatus: ShopRefundStatus;
  stockRestored: boolean;
  refundId?: string;
  alreadyCancelled?: boolean;
  error?: string;
}

export interface InitiateShopOrderRazorpayRefundInput {
  orderId: string;
  amount: number;
  reason: string;
  returnRequestId?: string;
  customerId?: string;
  vendorId?: string;
}

export interface InitiateShopOrderRazorpayRefundResult {
  success: boolean;
  refundStatus: ShopRefundStatus;
  refundId?: string;
  razorpayRefundId?: string;
  alreadyProcessed?: boolean;
  error?: string;
}

type LockedOrderRow = {
  id: string;
  order_status: string;
  payment_status: string | null;
  payment_method: string | null;
  customer_id: string;
  vendor_id: string | null;
  order_number: string | null;
  total_amount: string | number | null;
  metadata: Record<string, unknown> | string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
};

const DEFAULT_ALLOWED_STATUSES = ['pending', 'confirmed'];
const VENDOR_ALLOWED_STATUSES = ['pending', 'confirmed', 'processing'];

function parseMetadata(raw: unknown): Record<string, unknown> {
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isPaidOrder(row: LockedOrderRow): boolean {
  const ps = String(row.payment_status || '').toLowerCase();
  return ['paid', 'completed'].includes(ps);
}

async function lockShopOrder(
  client: PoolClient,
  orderId: string,
  owner?: { customerId?: string; vendorId?: string },
): Promise<LockedOrderRow | null> {
  const params: unknown[] = [orderId];
  let ownerClause = '';
  if (owner?.customerId) {
    params.push(owner.customerId);
    ownerClause = ` AND customer_id = $${params.length}::uuid`;
  } else if (owner?.vendorId) {
    params.push(owner.vendorId);
    ownerClause = ` AND vendor_id = $${params.length}::uuid`;
  }

  const res = await client.query(
    `SELECT id, order_status, payment_status, payment_method, customer_id, vendor_id,
            order_number, total_amount, metadata, cancelled_at, cancelled_by
     FROM orders
     WHERE id = $1::uuid${ownerClause}
     FOR UPDATE`,
    params,
  );
  return (res.rows[0] as LockedOrderRow | undefined) ?? null;
}

export async function restoreShopOrderStockIfNeeded(
  orderId: string,
  metadataFromOrderRow?: Record<string, unknown>,
): Promise<boolean> {
  const meta = metadataFromOrderRow ?? {};
  if (meta.stock_restored_at) return false;

  const items = await query(
    `SELECT product_sku_id, quantity
     FROM order_items
     WHERE order_id = $1::uuid AND product_sku_id IS NOT NULL`,
    [orderId],
  );

  let restored = false;
  for (const row of items.rows) {
    const skuId = row.product_sku_id ? String(row.product_sku_id) : '';
    const qty = Math.max(0, Math.floor(Number(row.quantity) || 0));
    if (skuId && qty > 0) {
      await incrementSkuStock(skuId, qty);
      restored = true;
    }
  }

  if (restored) {
    await query(
      `UPDATE orders
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('stock_restored_at', NOW()::text),
           updated_at = NOW()
       WHERE id = $1::uuid
         AND (metadata IS NULL OR metadata->>'stock_restored_at' IS NULL)`,
      [orderId],
    );
  }
  return restored;
}

async function sumActiveRefundsForPayment(client: PoolClient, paymentId: string): Promise<number> {
  const res = await client.query(
    `SELECT COALESCE(SUM(refund_amount), 0)::text AS total
     FROM refunds
     WHERE payment_id = $1::uuid
       AND refund_status NOT IN ('failed', 'rejected')`,
    [paymentId],
  );
  return parseFloat(String(res.rows[0]?.total ?? '0')) || 0;
}

async function findExistingShopRefund(
  client: PoolClient,
  orderId: string,
  amount: number,
): Promise<{ id: string; refund_status: string; razorpay_refund_id: string | null } | null> {
  const res = await client.query(
    `SELECT id::text, refund_status, razorpay_refund_id
     FROM refunds
     WHERE order_id = $1::uuid
       AND refund_status NOT IN ('failed', 'rejected')
       AND ABS(refund_amount - $2::numeric) < 0.01
     ORDER BY requested_at DESC NULLS LAST
     LIMIT 1`,
    [orderId, amount],
  );
  const row = res.rows[0];
  return row?.id
    ? {
        id: String(row.id),
        refund_status: String(row.refund_status),
        razorpay_refund_id: row.razorpay_refund_id ? String(row.razorpay_refund_id) : null,
      }
    : null;
}

async function fetchLatestCompletedPayment(
  client: PoolClient,
  orderId: string,
): Promise<{
  id: string;
  amount: number;
  razorpay_payment_id: string | null;
  customer_id: string;
  vendor_id: string | null;
} | null> {
  const res = await client.query(
    `SELECT id::text, amount::text, razorpay_payment_id, customer_id::text, vendor_id::text
     FROM payments
     WHERE order_id = $1::uuid
       AND LOWER(COALESCE(payment_status, '')) IN ('completed', 'paid')
     ORDER BY created_at DESC NULLS LAST
     LIMIT 1`,
    [orderId],
  );
  const row = res.rows[0];
  if (!row?.id) return null;
  return {
    id: String(row.id),
    amount: parseFloat(String(row.amount ?? '0')) || 0,
    razorpay_payment_id: row.razorpay_payment_id ? String(row.razorpay_payment_id) : null,
    customer_id: String(row.customer_id),
    vendor_id: row.vendor_id ? String(row.vendor_id) : null,
  };
}

function mapDbRefundStatus(status: string): ShopRefundStatus {
  const s = status.toLowerCase();
  if (s === 'completed') return 'completed';
  if (['processing', 'approved', 'pending'].includes(s)) return 'processing';
  if (s === 'failed') return 'pending_retry';
  return 'skipped';
}

export async function initiateShopOrderRazorpayRefund(
  input: InitiateShopOrderRazorpayRefundInput,
): Promise<InitiateShopOrderRazorpayRefundResult> {
  const requestedAmount = round2(input.amount);
  if (requestedAmount <= 0.009) {
    return { success: true, refundStatus: 'skipped' };
  }

  let refundRowId: string | undefined;
  let razorpayPaymentId: string | null = null;
  let existingRzRefundId: string | null = null;
  let existingStatus = '';
  let skipRazorpay = false;
  let razorpayAmount = requestedAmount;

  await withTransaction(async (client) => {
    const payment = await fetchLatestCompletedPayment(client, input.orderId);
    if (!payment?.razorpay_payment_id) return;

    razorpayPaymentId = payment.razorpay_payment_id;
    const alreadyRefunded = await sumActiveRefundsForPayment(client, payment.id);
    const available = round2(Math.max(0, payment.amount - alreadyRefunded));
    razorpayAmount = round2(Math.min(requestedAmount, available));

    if (razorpayAmount <= 0.009) {
      skipRazorpay = true;
      const anyExisting = await client.query(
        `SELECT id::text, refund_status, razorpay_refund_id
         FROM refunds
         WHERE order_id = $1::uuid
           AND refund_status NOT IN ('failed', 'rejected')
         ORDER BY requested_at DESC NULLS LAST
         LIMIT 1`,
        [input.orderId],
      );
      const row = anyExisting.rows[0];
      if (row?.id) {
        refundRowId = String(row.id);
        existingRzRefundId = row.razorpay_refund_id ? String(row.razorpay_refund_id) : null;
        existingStatus = String(row.refund_status);
      }
      return;
    }

    const existing = await findExistingShopRefund(client, input.orderId, razorpayAmount);
    if (existing) {
      refundRowId = existing.id;
      existingRzRefundId = existing.razorpay_refund_id;
      existingStatus = existing.refund_status;
      skipRazorpay =
        Boolean(existing.razorpay_refund_id) ||
        ['completed', 'approved'].includes(existing.refund_status);
      return;
    }

    const ins = await client.query(
      `INSERT INTO refunds (
         payment_id, order_id, customer_id, vendor_id, refund_amount, refund_reason,
         refund_status, refund_method, requested_at
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, 'pending', 'original', NOW())
       RETURNING id::text`,
      [
        payment.id,
        input.orderId,
        input.customerId || payment.customer_id,
        input.vendorId || payment.vendor_id,
        razorpayAmount,
        input.reason,
      ],
    );
    refundRowId = ins.rows[0]?.id;
  });

  if (!razorpayPaymentId) {
    return { success: true, refundStatus: 'skipped', refundId: refundRowId };
  }

  if (skipRazorpay) {
    return {
      success: true,
      refundStatus: mapDbRefundStatus(existingStatus || 'completed'),
      refundId: refundRowId,
      razorpayRefundId: existingRzRefundId || undefined,
      alreadyProcessed: true,
    };
  }

  if (!refundRowId) {
    return { success: false, refundStatus: 'pending_retry', error: 'Failed to create refund row' };
  }

  try {
    const razorpay = getRazorpayClient();
    const rzRefund = await razorpay.payments.refund({
      payment_id: razorpayPaymentId,
      amount: Math.round(razorpayAmount * 100),
    });
    const rzRefundId = String((rzRefund as { id?: string }).id ?? '');

    await query(
      `UPDATE refunds
       SET refund_status = 'processing',
           razorpay_refund_id = $1,
           processed_at = NOW()
       WHERE id = $2::uuid`,
      [rzRefundId || null, refundRowId],
    );

    void notifyShopRefundLifecycle({
      orderId: input.orderId,
      refundId: refundRowId,
      event: 'initiated',
      amount: razorpayAmount,
      customerId: input.customerId,
    }).catch(() => {});

    return {
      success: true,
      refundStatus: 'processing',
      refundId: refundRowId,
      razorpayRefundId: rzRefundId || undefined,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[shop-order-refund] Razorpay refund failed:', input.orderId, msg);
    await query(
      `UPDATE refunds
       SET refund_status = 'failed',
           retry_count = retry_count + 1
       WHERE id = $1::uuid`,
      [refundRowId],
    ).catch(() => {});
    return {
      success: false,
      refundStatus: 'pending_retry',
      refundId: refundRowId,
      error: msg,
    };
  }
}

export async function cancelPaidShopOrder(
  input: CancelPaidShopOrderInput,
): Promise<CancelPaidShopOrderResult> {
  const allowed = input.allowedStatuses ?? DEFAULT_ALLOWED_STATUSES;
  const reason = input.reason || 'Order cancelled';
  let refundStatus: ShopRefundStatus = 'none';
  let stockRestored = false;
  let refundId: string | undefined;
  let previousStatus = '';
  let customerId = '';
  let vendorId: string | null = null;
  let refundAmount = 0;
  let needsRazorpay = false;
  let alreadyCancelled = false;

  const owner =
    input.customerId != null
      ? { customerId: input.customerId }
      : input.vendorId != null
        ? { vendorId: input.vendorId }
        : undefined;

  if (!owner?.customerId && !owner?.vendorId) {
    return {
      success: false,
      orderId: input.orderId,
      status: 'unknown',
      cancelledBy: null,
      refundStatus: 'none',
      stockRestored: false,
      error: 'Order not found',
    };
  }

  try {
    await withTransaction(async (client) => {
      const row = await lockShopOrder(client, input.orderId, owner);
      if (!row) {
        throw Object.assign(new Error('Order not found'), { statusCode: 404 });
      }

      previousStatus = String(row.order_status || '');
      customerId = String(row.customer_id);
      vendorId = row.vendor_id ? String(row.vendor_id) : null;
      const meta = parseMetadata(row.metadata);

      if (String(row.order_status).toLowerCase() === 'cancelled') {
        alreadyCancelled = true;
        const existing = isPaidOrder(row)
          ? await findExistingShopRefund(
              client,
              input.orderId,
              round2(parseFloat(String(row.total_amount ?? 0))),
            )
          : null;
        if (existing) {
          refundId = existing.id;
          refundStatus = mapDbRefundStatus(existing.refund_status);
        }
        return;
      }

      if (!allowed.includes(String(row.order_status))) {
        throw Object.assign(
          new Error(`Order cannot be cancelled. Current status: ${row.order_status}`),
          { statusCode: 400 },
        );
      }

      await client.query(
        `UPDATE orders
         SET order_status = 'cancelled',
             cancelled_at = COALESCE(cancelled_at, NOW()),
             cancellation_reason = $2,
             cancelled_by = $3,
             updated_at = NOW()
         WHERE id = $1::uuid`,
        [input.orderId, reason, input.cancelledBy],
      );

      if (!meta.stock_restored_at) {
        stockRestored = await restoreShopOrderStockIfNeeded(input.orderId, meta);
      }

      if (isPaidOrder(row)) {
        const payment = await fetchLatestCompletedPayment(client, input.orderId);
        if (payment) {
          const alreadyRefunded = await sumActiveRefundsForPayment(client, payment.id);
          const available = round2(Math.max(0, payment.amount - alreadyRefunded));
          refundAmount = round2(
            Math.min(
              available,
              parseFloat(String(payment.amount)) || parseFloat(String(row.total_amount ?? 0)),
            ),
          );
          if (refundAmount > 0.009) {
            const existing = await findExistingShopRefund(client, input.orderId, refundAmount);
            if (existing) {
              refundId = existing.id;
              refundStatus = mapDbRefundStatus(existing.refund_status);
              needsRazorpay =
                !existing.razorpay_refund_id &&
                !['completed', 'processing', 'approved'].includes(existing.refund_status);
            } else {
              const ins = await client.query(
                `INSERT INTO refunds (
                   payment_id, order_id, customer_id, vendor_id, refund_amount, refund_reason,
                   refund_status, refund_method, requested_at
                 ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, 'pending', 'original', NOW())
                 RETURNING id::text`,
                [payment.id, input.orderId, customerId, vendorId, refundAmount, reason],
              );
              refundId = ins.rows[0]?.id;
              refundStatus = 'pending_retry';
              needsRazorpay = true;
            }
          }
        }
      }
    });

    if (alreadyCancelled) {
      return {
        success: true,
        orderId: input.orderId,
        status: 'cancelled',
        cancelledBy: input.cancelledBy,
        refundStatus: refundStatus === 'none' ? 'skipped' : refundStatus,
        stockRestored: false,
        alreadyCancelled: true,
        refundId,
      };
    }

    if (needsRazorpay && refundAmount > 0.009) {
      const rz = await initiateShopOrderRazorpayRefund({
        orderId: input.orderId,
        amount: refundAmount,
        reason,
        customerId,
        vendorId: vendorId || undefined,
      });
      refundStatus = rz.refundStatus;
      refundId = rz.refundId || refundId;
    }

    void notifyShopOrderStatusChangeAsync(input.orderId, previousStatus, reason);

    return {
      success: true,
      orderId: input.orderId,
      status: 'cancelled',
      cancelledBy: input.cancelledBy,
      refundStatus,
      stockRestored,
      refundId,
    };
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    const message = err instanceof Error ? err.message : String(err);
    if (statusCode === 404) {
      return {
        success: false,
        orderId: input.orderId,
        status: previousStatus || 'unknown',
        cancelledBy: null,
        refundStatus: 'none',
        stockRestored: false,
        error: 'Order not found',
      };
    }
    if (statusCode === 400) {
      return {
        success: false,
        orderId: input.orderId,
        status: previousStatus || 'unknown',
        cancelledBy: null,
        refundStatus: 'none',
        stockRestored: false,
        error: message,
      };
    }
    throw err;
  }
}

async function notifyShopOrderStatusChangeAsync(
  orderId: string,
  previousStatus: string,
  cancellationReason: string,
): Promise<void> {
  try {
    const { notifyShopOrderStatusChange } = await import('../shop-order-notifications');
    await notifyShopOrderStatusChange({
      orderId,
      previousStatus,
      newStatus: 'cancelled',
      cancellationReason,
    });
  } catch (e) {
    console.warn('[shop-order-refund] cancel notification failed:', e);
  }
}

export async function discardDraftShopOrder(params: {
  orderId: string;
  customerId: string;
  reason?: string;
}): Promise<{ success: boolean; orderId: string; error?: string }> {
  const ownerCheck = await query(
    `SELECT id, order_status FROM orders WHERE id = $1::uuid AND customer_id = $2::uuid LIMIT 1`,
    [params.orderId, params.customerId],
  );
  if (ownerCheck.rows.length === 0) {
    return { success: false, orderId: params.orderId, error: 'Order not found' };
  }
  const st = String(ownerCheck.rows[0].order_status || '').toLowerCase();
  if (st !== 'pending_payment') {
    return {
      success: false,
      orderId: params.orderId,
      error: `Only unpaid draft orders can be cancelled. Current status: ${st}`,
    };
  }

  const reason = params.reason || 'customer_request';
  const result = await discardUnpaidShopOrder(params.orderId, reason, {
    paymentStatus: 'failed',
    cancelledBy: 'pet_parent',
  });

  return {
    success: result.discarded,
    orderId: params.orderId,
    error: result.discarded ? undefined : 'Order could not be cancelled',
  };
}

export async function retryPendingShopRefunds(options?: {
  limit?: number;
}): Promise<{ retried: number; errors: string[] }> {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 20);
  const { rows } = await query(
    `SELECT r.id::text, r.order_id::text, r.refund_amount::text, r.refund_reason, r.customer_id::text, r.vendor_id::text
     FROM refunds r
     WHERE r.order_id IS NOT NULL
       AND r.refund_status IN ('pending', 'failed')
       AND r.razorpay_refund_id IS NULL
     ORDER BY r.requested_at ASC NULLS LAST
     LIMIT $1`,
    [limit],
  );

  let retried = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const orderId = String(row.order_id);
    const amount = parseFloat(String(row.refund_amount)) || 0;
    const result = await initiateShopOrderRazorpayRefund({
      orderId,
      amount,
      reason: String(row.refund_reason || 'Shop refund retry'),
      customerId: row.customer_id ? String(row.customer_id) : undefined,
      vendorId: row.vendor_id ? String(row.vendor_id) : undefined,
    });
    if (result.success && result.refundStatus !== 'skipped') {
      retried += 1;
    } else if (result.error) {
      errors.push(`${row.id}: ${result.error}`);
    }
  }
  return { retried, errors };
}

const refundNotifyDedupe = new Set<string>();

export async function notifyShopRefundLifecycle(params: {
  orderId: string;
  refundId?: string;
  event: 'initiated' | 'completed' | 'failed';
  amount?: number;
  customerId?: string;
  orderNumber?: string;
  vendorId?: string;
}): Promise<void> {
  const dedupeKey = `shop-refund-${params.refundId || params.orderId}-${params.event}`;
  if (refundNotifyDedupe.has(dedupeKey)) return;
  refundNotifyDedupe.add(dedupeKey);
  if (refundNotifyDedupe.size > 500) refundNotifyDedupe.clear();

  try {
    const { dispatchNotification } = await import('../notification-dispatch');
    let customerId = params.customerId;
    let orderNumber = params.orderNumber;
    if (!customerId || !orderNumber) {
      const r = await query(
        `SELECT customer_id::text, order_number FROM orders WHERE id = $1::uuid LIMIT 1`,
        [params.orderId],
      );
      customerId = customerId || (r.rows[0]?.customer_id ? String(r.rows[0].customer_id) : undefined);
      orderNumber = orderNumber || (r.rows[0]?.order_number ? String(r.rows[0].order_number) : params.orderId);
    }
    if (!customerId) return;

    const titles: Record<string, string> = {
      initiated: 'Refund initiated',
      completed: 'Refund completed',
      failed: 'Refund pending',
    };
    const messages: Record<string, string> = {
      initiated: `Your refund for order #${orderNumber} has been initiated${params.amount ? ` (₹${params.amount.toFixed(2)})` : ''}.`,
      completed: `Refund for order #${orderNumber} has been credited to your original payment method.`,
      failed: `We're retrying your refund for order #${orderNumber}. No action needed from you.`,
    };

    await dispatchNotification({
      recipientId: customerId,
      recipientType: 'customer',
      notificationType: `shop_refund_${params.event}`,
      title: titles[params.event] || 'Refund update',
      message: messages[params.event] || `Refund update for order #${orderNumber}`,
      channels: { inApp: true, push: true },
      priority: params.event === 'completed' ? 'high' : 'normal',
      data: {
        orderId: params.orderId,
        orderNumber,
        refundId: params.refundId,
        dedupeKey,
        orderType: 'ecommerce',
      },
    });
  } catch (e) {
    console.warn('[shop-order-refund] notifyShopRefundLifecycle failed:', e);
  }
}

export { VENDOR_ALLOWED_STATUSES };
