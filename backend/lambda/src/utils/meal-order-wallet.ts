/**
 * Wallet debit toward a pending_payment meal order (one-time checkout).
 */

import type { PoolClient } from 'pg';
import { query, withTransaction } from '../database/rds-connection';
import { debitCustomerWalletForMealOrderInTransaction } from './wallet-operations';

function parseWalletDebitFromSnapshot(raw: unknown): number {
  if (raw == null) return 0;
  let snap: Record<string, unknown> = {};
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const o = JSON.parse(raw) as unknown;
      if (typeof o === 'object' && o != null && !Array.isArray(o)) snap = o as Record<string, unknown>;
    } catch {
      return 0;
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    snap = raw as Record<string, unknown>;
  }
  const checkout = snap.checkoutPricing;
  if (checkout && typeof checkout === 'object' && !Array.isArray(checkout)) {
    const w = (checkout as Record<string, unknown>).walletDebitInr;
    const n = typeof w === 'number' ? w : parseFloat(String(w ?? '0'));
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100;
  }
  const direct = snap.walletDebitInr;
  const d = typeof direct === 'number' ? direct : parseFloat(String(direct ?? '0'));
  return Number.isFinite(d) && d > 0 ? Math.round(d * 100) / 100 : 0;
}

export async function applyWalletDebitToPendingMealOrder(
  orderId: string,
  customerId: string,
  amountInRupees: number,
  idempotencyKey: string,
): Promise<{
  success: boolean;
  debited: number;
  remainderInRupees: number;
  balanceAfter?: number;
  error?: string;
}> {
  const oid = String(orderId || '').trim();
  const cid = String(customerId || '').trim();
  const key = String(idempotencyKey || '').trim();
  if (!oid || !cid || !key) {
    return { success: false, debited: 0, remainderInRupees: 0, error: 'orderId, customerId, idempotencyKey required' };
  }
  const req = Math.round(Number(amountInRupees) * 100) / 100;
  if (!Number.isFinite(req) || req <= 0) {
    return { success: false, debited: 0, remainderInRupees: 0, error: 'amountInRupees must be positive' };
  }

  const orderRes = await query(
    `SELECT id, customer_id, payment_status, status, total_amount::text AS total_amount, purchase_snapshot
     FROM meal_orders WHERE id = $1::uuid LIMIT 1`,
    [oid],
  );
  const order = orderRes.rows?.[0] as
    | {
        id: string;
        customer_id: string;
        payment_status?: string;
        status?: string;
        total_amount?: string;
        purchase_snapshot?: unknown;
      }
    | undefined;
  if (!order) {
    return { success: false, debited: 0, remainderInRupees: 0, error: 'Order not found' };
  }
  if (String(order.customer_id) !== cid) {
    return { success: false, debited: 0, remainderInRupees: 0, error: 'Order not found' };
  }
  if (String(order.payment_status || '') === 'paid' || String(order.status || '') === 'confirmed') {
    return { success: false, debited: 0, remainderInRupees: 0, error: 'Order is already paid' };
  }

  const invoiceTotal = parseFloat(String(order.total_amount ?? '0')) || 0;
  if (!(invoiceTotal > 0.009)) {
    return { success: false, debited: 0, remainderInRupees: 0, error: 'Order has no payable total' };
  }

  try {
    let debitedOut = 0;
    let balanceAfterOut: number | undefined;

    await withTransaction(async (client: PoolClient) => {
      const lock = await client.query(
        `SELECT id, total_amount::text AS total_amount, purchase_snapshot
         FROM meal_orders WHERE id = $1::uuid FOR UPDATE`,
        [oid],
      );
      const row = lock.rows?.[0] as { total_amount?: string; purchase_snapshot?: unknown } | undefined;
      if (!row) throw Object.assign(new Error('Order not found'), { statusCode: 404 });

      const total = parseFloat(String(row.total_amount ?? '0')) || 0;
      const alreadyWallet = parseWalletDebitFromSnapshot(row.purchase_snapshot);
      const cap = Math.max(0, Math.round((total - alreadyWallet) * 100) / 100);
      const debitAmount = Math.max(0, Math.min(req, cap));
      if (debitAmount <= 0) {
        debitedOut = 0;
        return;
      }

      const { debited, balanceAfter } = await debitCustomerWalletForMealOrderInTransaction(client, {
        customerId: cid,
        mealOrderId: oid,
        amount: debitAmount,
        idempotencyKey: key,
      });
      debitedOut = debited;
      balanceAfterOut = balanceAfter;

      const newWalletTotal = Math.round((alreadyWallet + debited) * 100) / 100;
      let snap: Record<string, unknown> = {};
      const raw = row.purchase_snapshot;
      if (typeof raw === 'string' && raw.trim()) {
        try {
          const o = JSON.parse(raw) as unknown;
          if (typeof o === 'object' && o != null && !Array.isArray(o)) snap = o as Record<string, unknown>;
        } catch {
          snap = {};
        }
      } else if (typeof raw === 'object' && raw != null && !Array.isArray(raw)) {
        snap = { ...(raw as Record<string, unknown>) };
      }
      const checkout =
        snap.checkoutPricing && typeof snap.checkoutPricing === 'object' && !Array.isArray(snap.checkoutPricing)
          ? { ...(snap.checkoutPricing as Record<string, unknown>) }
          : {};
      checkout.walletDebitInr = newWalletTotal;
      snap.checkoutPricing = checkout;
      snap.walletDebitInr = newWalletTotal;

      await client.query(
        `UPDATE meal_orders SET purchase_snapshot = $2::jsonb, updated_at = NOW() WHERE id = $1::uuid`,
        [oid, JSON.stringify(snap)],
      );
    });

    const again = await query(
      `SELECT total_amount::text AS total_amount, purchase_snapshot FROM meal_orders WHERE id = $1::uuid LIMIT 1`,
      [oid],
    );
    const againRow = again.rows?.[0] as { total_amount?: string; purchase_snapshot?: unknown } | undefined;
    const inv = parseFloat(String(againRow?.total_amount ?? invoiceTotal)) || 0;
    const wtot = parseWalletDebitFromSnapshot(againRow?.purchase_snapshot);
    const remainder = Math.max(0, Math.round((inv - wtot) * 100) / 100);
    return { success: true, debited: debitedOut, remainderInRupees: remainder, balanceAfter: balanceAfterOut };
  } catch (e: unknown) {
    const err = e as { message?: string; statusCode?: number };
    return {
      success: false,
      debited: 0,
      remainderInRupees: 0,
      error: err.message || 'Wallet debit failed',
    };
  }
}

export function mealOrderWalletDebitFromRow(row: { purchase_snapshot?: unknown }): number {
  return parseWalletDebitFromSnapshot(row.purchase_snapshot);
}

/** Resolve wallet INR applied to a meal order (snapshot first, then wallet ledger). */
export async function resolveMealOrderWalletPaidInr(
  mealOrderId: string,
  customerId: string,
  purchaseSnapshot?: unknown,
): Promise<number> {
  const fromSnap = parseWalletDebitFromSnapshot(purchaseSnapshot);
  if (fromSnap > 0.009) return fromSnap;

  const oid = String(mealOrderId || '').trim();
  const cid = String(customerId || '').trim();
  if (!oid) return 0;

  try {
    const refRes = await query(
      `SELECT COALESCE(SUM(ABS(wt.amount)), 0)::text AS total
       FROM wallet_transactions wt
       WHERE wt.transaction_type = 'debit'
         AND (
           (wt.reference_type = 'meal_order' AND wt.reference_id = $1)
           OR wt.description ILIKE '%' || $1 || '%'
         )
         AND (
           $2::uuid IS NULL
           OR wt.customer_id = $2::uuid
           OR wt.wallet_id IN (SELECT id FROM customer_wallets WHERE customer_id = $2::uuid)
         )`,
      [oid, cid || null],
    );
    const fromLedger = parseFloat(String((refRes as any).rows?.[0]?.total ?? '0')) || 0;
    if (fromLedger > 0.009) return Math.round(fromLedger * 100) / 100;
  } catch {
    /* ignore */
  }
  return 0;
}

export function isLikelyRazorpayPaymentCaptureId(id: unknown): boolean {
  const s = String(id ?? '').trim();
  return s.startsWith('pay_');
}
