/**
 * 5-minute payment hold for unpaid ecommerce shop orders (Razorpay checkout abandoned).
 * Drafts use order_status = pending_payment and stay hidden from vendors until paid.
 */

import type { PoolClient } from 'pg';
import { query, withTransaction } from '../database/rds-connection';
import { logAuditEntry } from './audit-log';
import {
  paymentHoldExpiresAt,
  secondsRemainingUntilHoldExpiry,
  PAYMENT_HOLD_TTL_SECONDS,
} from './payment-hold';
import { incrementSkuStock } from './product-sku-order';
import { reconcileShopOrderPayment } from './payments/shop-payment-reconciliation';

export { paymentHoldExpiresAt, secondsRemainingUntilHoldExpiry, PAYMENT_HOLD_TTL_SECONDS };

const SHOP_UNPAID_PAYMENT = `LOWER(COALESCE(o.payment_status, '')) NOT IN ('paid', 'completed', 'expired', 'refunded', 'failed')`;
const SHOP_HOLD_STATUS = `LOWER(COALESCE(o.order_status, '')) IN ('pending_payment', 'pending')`;
const SHOP_NOT_COD = `LOWER(COALESCE(o.payment_method, 'online')) NOT IN ('cod', 'cash_on_delivery')`;

export function isShopOrderPaymentHoldActive(row: {
  order_status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  payment_hold_expires_at?: Date | string | null;
}): boolean {
  const ps = String(row.payment_status || '').toLowerCase();
  if (['paid', 'completed', 'expired', 'refunded', 'failed'].includes(ps)) return false;
  const st = String(row.order_status || '').toLowerCase();
  if (!['pending_payment', 'pending'].includes(st)) return false;
  const pm = String(row.payment_method || 'online').toLowerCase();
  if (pm === 'cod' || pm === 'cash_on_delivery') return false;
  const exp = row.payment_hold_expires_at;
  if (!exp) return true;
  return new Date(exp).getTime() > Date.now();
}

export function isShopOrderPaymentHoldExpired(row: {
  order_status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  payment_hold_expires_at?: Date | string | null;
  created_at?: Date | string | null;
}): boolean {
  const ps = String(row.payment_status || '').toLowerCase();
  if (['paid', 'completed', 'expired', 'refunded', 'failed'].includes(ps)) return false;
  const st = String(row.order_status || '').toLowerCase();
  if (!['pending_payment', 'pending'].includes(st)) return false;
  const pm = String(row.payment_method || 'online').toLowerCase();
  if (pm === 'cod' || pm === 'cash_on_delivery') return false;
  const exp = row.payment_hold_expires_at;
  if (exp) return new Date(exp).getTime() <= Date.now();
  if (row.created_at) {
    return Date.now() - new Date(String(row.created_at)).getTime() >= PAYMENT_HOLD_TTL_SECONDS * 1000;
  }
  return false;
}

export interface DiscardUnpaidShopOrderResult {
  discarded: boolean;
  orderId: string;
  reason: string;
}

async function restoreWalletForDiscardedOrder(
  client: PoolClient,
  order: {
    id: string;
    customer_id?: string | null;
    order_number?: string | null;
    wallet_amount_applied?: number | string | null;
  }
): Promise<void> {
  const walletApplied = Math.round((parseFloat(String(order.wallet_amount_applied ?? 0)) || 0) * 100) / 100;
  const customerId = order.customer_id ? String(order.customer_id) : '';
  if (!customerId || walletApplied <= 0) return;

  const orderId = String(order.id);
  const dup = await client.query(
    `SELECT id FROM wallet_transactions
     WHERE customer_id = $1::uuid
       AND transaction_type = 'credit'
       AND COALESCE(reference_type, '') = 'order'
       AND reference_id::text = $2
     LIMIT 1`,
    [customerId, orderId]
  );
  if (dup.rows.length > 0) return;

  await client.query(
    `INSERT INTO customer_wallets (customer_id, balance, currency, updated_at)
     VALUES ($1::uuid, 0, 'INR', NOW())
     ON CONFLICT (customer_id) DO NOTHING`,
    [customerId]
  );
  await client.query(
    `UPDATE customer_wallets
     SET balance = balance + $1::numeric, updated_at = NOW()
     WHERE customer_id = $2::uuid`,
    [walletApplied, customerId]
  );
  await client.query(
    `INSERT INTO wallet_transactions
       (customer_id, transaction_type, amount, description, reference_type, reference_id, created_at)
     VALUES ($1::uuid, 'credit', $2, $3, 'order', $4::uuid, NOW())
     ON CONFLICT DO NOTHING`,
    [
      customerId,
      walletApplied,
      `Restored from unpaid order ${order.order_number || orderId}`,
      orderId,
    ]
  );
}

async function restoreSkuStockForOrder(orderId: string): Promise<void> {
  const items = await query(
    `SELECT product_sku_id, quantity
     FROM order_items
     WHERE order_id = $1::uuid
       AND product_sku_id IS NOT NULL`,
    [orderId]
  );
  for (const row of items.rows) {
    const skuId = row.product_sku_id ? String(row.product_sku_id) : '';
    const qty = Math.max(0, Math.floor(Number(row.quantity) || 0));
    if (skuId && qty > 0) {
      await incrementSkuStock(skuId, qty);
    }
  }
}

/**
 * Cancel an unpaid shop checkout draft and restore stock/wallet.
 * Idempotent if already cancelled/paid.
 */
export async function discardUnpaidShopOrder(
  orderId: string,
  reason: string,
  options?: {
    requestId?: string;
    paymentStatus?: 'expired' | 'failed';
    cancelledBy?: 'pet_parent' | 'provider' | 'system';
  }
): Promise<DiscardUnpaidShopOrderResult> {
  const paymentStatus = options?.paymentStatus ?? (reason === 'payment_window_expired' ? 'expired' : 'failed');
  const requestId = options?.requestId;
  let discarded = false;
  let oldStatus = '';
  let oldPaymentStatus = '';

  await withTransaction(async (client) => {
    const locked = await client.query(
      `SELECT id, order_status, payment_status, payment_method, customer_id,
              order_number, wallet_amount_applied, payment_hold_expires_at, created_at
       FROM orders WHERE id = $1::uuid FOR UPDATE`,
      [orderId]
    );
    if (locked.rows.length === 0) return;
    const cur = locked.rows[0];
    const curPs = String(cur.payment_status || '').toLowerCase();
    if (['paid', 'completed', 'refunded'].includes(curPs)) return;
    const curSt = String(cur.order_status || '').toLowerCase();
    if (curSt === 'cancelled' || curSt === 'returned' || curSt === 'delivered') return;
    const pm = String(cur.payment_method || 'online').toLowerCase();
    if (pm === 'cod' || pm === 'cash_on_delivery') return;
    // Only discard unpaid drafts (pending_payment or legacy unpaid pending)
    if (!['pending_payment', 'pending'].includes(curSt)) return;

    oldStatus = String(cur.order_status || 'pending');
    oldPaymentStatus = String(cur.payment_status || 'pending');

    const cancelledBy = options?.cancelledBy ?? 'system';
    await client.query(
      `UPDATE orders
       SET order_status = 'cancelled',
           payment_status = $2,
           cancellation_reason = $3,
           cancelled_by = $4,
           cancelled_at = COALESCE(cancelled_at, NOW()),
           payment_hold_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $1::uuid`,
      [orderId, paymentStatus, reason, cancelledBy]
    );

    await restoreWalletForDiscardedOrder(client, cur);
    discarded = true;
  });

  if (discarded) {
    try {
      await restoreSkuStockForOrder(orderId);
    } catch (stockErr) {
      console.warn('[shop-payment-hold] Failed to restore SKU stock for order', orderId, stockErr);
    }

    await logAuditEntry({
      entityType: 'order',
      entityId: orderId,
      action: 'update',
      oldValues: { order_status: oldStatus, payment_status: oldPaymentStatus },
      newValues: {
        order_status: 'cancelled',
        payment_status: paymentStatus,
        cancellation_reason: reason,
        paymentHoldDiscarded: true,
      },
      changedFields: ['order_status', 'payment_status', 'cancellation_reason'],
      actorId: 'system',
      actorType: 'system',
      requestId,
    }).catch(() => {});
  }

  return { discarded, orderId, reason };
}

export interface ExpireShopPaymentHoldsResult {
  expiredCount: number;
  orderIds: string[];
  timestamp: string;
}

/**
 * Cancel unpaid shop orders whose hold window has elapsed.
 */
export async function expireShopPaymentHolds(options?: {
  limit?: number;
  requestId?: string;
}): Promise<ExpireShopPaymentHoldsResult> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  const requestId = options?.requestId;

  const { rows } = await query(
    `SELECT o.id
     FROM orders o
     WHERE ${SHOP_UNPAID_PAYMENT}
       AND ${SHOP_HOLD_STATUS}
       AND ${SHOP_NOT_COD}
       AND (
         (o.payment_hold_expires_at IS NOT NULL AND o.payment_hold_expires_at <= NOW())
         OR (
           o.payment_hold_expires_at IS NULL
           AND o.created_at IS NOT NULL
           AND o.created_at + INTERVAL '5 minutes' <= NOW()
           AND LOWER(COALESCE(o.order_status, '')) = 'pending_payment'
         )
       )
     ORDER BY COALESCE(o.payment_hold_expires_at, o.created_at) ASC
     LIMIT $1`,
    [limit]
  );

  const orderIds: string[] = [];
  for (const row of rows) {
    const id = String(row.id);
    try {
      const reconciled = await reconcileShopOrderPayment(id, {
        source: 'expire-hold-sweep',
      }).catch((err) => {
        console.warn('[shop-payment-hold] reconcile before expiry failed:', id, err);
        return false;
      });
      if (reconciled) {
        console.log('[shop-payment-hold] Paid on Razorpay — skipped expiry discard:', id);
        continue;
      }

      const result = await discardUnpaidShopOrder(id, 'payment_window_expired', {
        requestId,
        paymentStatus: 'expired',
      });
      if (result.discarded) orderIds.push(id);
    } catch (err) {
      console.warn('[shop-payment-hold] Failed to expire shop order', id, err);
    }
  }

  return {
    expiredCount: orderIds.length,
    orderIds,
    timestamp: new Date().toISOString(),
  };
}

export interface ShopOrderPaymentResumeContext {
  entityType: 'shop_order';
  entityId: string;
  orderId: string;
  orderNumber: string | null;
  customerId: string;
  vendorId: string;
  vendorName?: string | null;
  /** Gross payable after wallet (INR). */
  payableAmount: number;
  /** @deprecated Prefer payableAmount — kept for older clients. */
  amount: number;
  currency: string;
  paymentHoldExpiresAt: string | null;
  secondsRemaining: number;
  canResume: boolean;
  razorpayOrderId: string | null;
  paymentId: string | null;
}

/**
 * Returns checkout context to resume Razorpay for an unpaid shop order within the hold window.
 */
export async function buildShopOrderPaymentResumeContext(
  orderId: string
): Promise<ShopOrderPaymentResumeContext | null> {
  const { rows } = await query(
    `SELECT o.*, v.business_name AS vendor_name
     FROM orders o
     LEFT JOIN vendors v ON v.id = o.vendor_id
     WHERE o.id = $1::uuid
     LIMIT 1`,
    [orderId]
  );
  if (rows.length === 0) return null;

  const o = rows[0] as Record<string, unknown>;
  const st = String(o.order_status || '').toLowerCase();
  const ps = String(o.payment_status || '').toLowerCase();
  const pm = String(o.payment_method || 'online').toLowerCase();

  if (st !== 'pending_payment') return null;
  if (['paid', 'completed', 'expired', 'failed', 'refunded'].includes(ps)) return null;
  if (pm === 'cod' || pm === 'cash_on_delivery') return null;

  const expiresAt = o.payment_hold_expires_at
    ? new Date(String(o.payment_hold_expires_at)).toISOString()
    : null;
  const canResume = isShopOrderPaymentHoldActive({
    order_status: st,
    payment_status: ps,
    payment_method: pm,
    payment_hold_expires_at: expiresAt,
  });
  const secondsRemaining = secondsRemainingUntilHoldExpiry(expiresAt);

  const total = Number(o.total_amount || 0);
  const wallet = Number(o.wallet_amount_applied || 0);
  const payableAmount = Math.max(0, Math.round((total - wallet) * 100) / 100);

  const payRes = await query(
    `SELECT id, razorpay_order_id, amount, currency, payment_status
     FROM payments
     WHERE order_id = $1::uuid
       AND LOWER(COALESCE(payment_status, '')) NOT IN ('paid', 'completed')
     ORDER BY created_at DESC
     LIMIT 1`,
    [orderId]
  );
  const pay = payRes.rows[0] as Record<string, unknown> | undefined;
  const pendingPayAmount = pay?.amount != null ? Number(pay.amount) : 0;
  const resolvedPayable =
    pendingPayAmount > 0.009 ? Math.round(pendingPayAmount * 100) / 100 : payableAmount;

  return {
    entityType: 'shop_order',
    entityId: orderId,
    orderId,
    orderNumber: o.order_number != null ? String(o.order_number) : null,
    customerId: String(o.customer_id || ''),
    vendorId: String(o.vendor_id || ''),
    vendorName: (o.vendor_name as string) || null,
    payableAmount: resolvedPayable,
    amount: resolvedPayable,
    currency: String(pay?.currency || 'INR'),
    paymentHoldExpiresAt: expiresAt,
    secondsRemaining,
    canResume,
    razorpayOrderId: pay?.razorpay_order_id ? String(pay.razorpay_order_id) : null,
    paymentId: pay?.id ? String(pay.id) : null,
  };
}
