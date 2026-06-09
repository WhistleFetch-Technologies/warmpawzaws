/**
 * Phase 3: Approve meal refund case → Razorpay/wallet via meal-order-original-refund.
 */

import { query } from '../database/rds-connection';
import { notifyMealEvent } from './meal-delivery-notifications';
import {
  computeMealRefundRecommendation,
  isMealOrderPaidForRefund,
} from './meal-refund-cases';
import { processMealOrderAdminOriginalRefund } from './payments/meal-order-original-refund';

export type MealRefundCaseExecutionResult = {
  ok: boolean;
  error?: string;
  status?: string;
  refundsRowId?: string;
  razorpayRefundId?: string;
  refundAmountExecuted?: number;
  alreadyProcessed?: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function loadCaseForExecution(caseId: string): Promise<Record<string, unknown> | null> {
  const res = await query(
    `SELECT mrc.id::text, mrc.meal_order_id::text, mrc.status,
            mrc.recommended_refund_amount::text, mrc.cancellation_reason,
            mrc.cancellation_source,
            mo.payment_status, mo.total_amount::text, mo.cancelled_by,
            mo.picked_up_at, mo.delivered_at,
            p.amount::text AS payment_amount,
            dt.status AS tracking_status
     FROM meal_refund_cases mrc
     JOIN meal_orders mo ON mo.id = mrc.meal_order_id
     LEFT JOIN delivery_tracking dt ON dt.meal_order_id = mo.id
     LEFT JOIN payments p ON p.transaction_id = 'meal_order:' || mo.id::text
       AND p.payment_status IN ('completed', 'paid')
     WHERE mrc.id = $1::uuid
     ORDER BY dt.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST
     LIMIT 1`,
    [caseId],
  );
  const row = res.rows?.[0];
  return row ? (row as Record<string, unknown>) : null;
}

export async function notifyMealRefundApproved(params: {
  mealOrderId: string;
  customerId: string;
  orderNumber?: string;
  vendorName?: string;
  amount?: number;
  caseId: string;
}): Promise<void> {
  await notifyMealEvent({
    recipientId: params.customerId,
    recipientType: 'customer',
    eventType: 'meal_refund_approved',
    orderId: params.mealOrderId,
    dedupeScopeId: `meal_refund_approved:${params.caseId}`,
    orderNumber: params.orderNumber,
    vendorName: params.vendorName,
    refundAmount: params.amount ? `₹${params.amount.toFixed(2)}` : undefined,
  }).catch((e) =>
    console.warn('[meal-refund-execution] approved notify failed:', (e as Error).message),
  );
}

export async function notifyMealRefundCompleted(params: {
  mealOrderId: string;
  customerId: string;
  orderNumber?: string;
  vendorName?: string;
  amount?: number;
  caseId: string;
}): Promise<void> {
  await notifyMealEvent({
    recipientId: params.customerId,
    recipientType: 'customer',
    eventType: 'meal_refund_completed',
    orderId: params.mealOrderId,
    dedupeScopeId: `meal_refund_completed:${params.caseId}`,
    orderNumber: params.orderNumber,
    vendorName: params.vendorName,
    refundAmount: params.amount ? `₹${params.amount.toFixed(2)}` : undefined,
  }).catch((e) =>
    console.warn('[meal-refund-execution] completed notify failed:', (e as Error).message),
  );
}

/**
 * Webhook / reconciliation: terminal status on meal_refund_cases from refunds row.
 */
export async function reconcileMealRefundCaseFromRefundRow(params: {
  refundRowId?: string;
  razorpayRefundId?: string;
  webhookStatus: 'completed' | 'processing' | 'failed';
  failureReason?: string;
}): Promise<{ updated: boolean; caseId?: string }> {
  const rzId = params.razorpayRefundId?.trim();
  const refundId = params.refundRowId?.trim();
  if (!rzId && !refundId) return { updated: false };

  const lookup = await query(
    `SELECT mrc.id::text, mrc.status, mrc.meal_order_id::text,
            mo.customer_id::text, mo.order_number, v.business_name AS vendor_name,
            mrc.refund_amount_executed::text
     FROM meal_refund_cases mrc
     JOIN meal_orders mo ON mo.id = mrc.meal_order_id
     LEFT JOIN vendors v ON v.id = mo.vendor_id
     WHERE ($1::uuid IS NOT NULL AND mrc.refunds_row_id = $1::uuid)
        OR ($2::text IS NOT NULL AND mrc.razorpay_refund_id = $2)
     LIMIT 1`,
    [refundId || null, rzId || null],
  );
  let caseRow = lookup.rows?.[0] as Record<string, unknown> | undefined;

  if (!caseRow?.id && rzId) {
    const byPayment = await query(
      `SELECT mrc.id::text, mrc.status, mrc.meal_order_id::text,
              mo.customer_id::text, mo.order_number, v.business_name AS vendor_name,
              mrc.refund_amount_executed::text
       FROM refunds r
       JOIN payments p ON p.id = r.payment_id
       JOIN meal_refund_cases mrc ON mrc.meal_order_id::text = replace(p.transaction_id, 'meal_order:', '')
       JOIN meal_orders mo ON mo.id = mrc.meal_order_id
       LEFT JOIN vendors v ON v.id = mo.vendor_id
       WHERE r.razorpay_refund_id = $1
         AND p.transaction_id LIKE 'meal_order:%'
       LIMIT 1`,
      [rzId],
    );
    caseRow = byPayment.rows?.[0] as Record<string, unknown> | undefined;
  }

  if (!caseRow?.id) return { updated: false };
  const caseId = String(caseRow.id);
  const currentStatus = String(caseRow.status || '');

  if (params.webhookStatus === 'failed') {
    if (currentStatus === 'refund_failed') return { updated: false, caseId };
    await query(
      `UPDATE meal_refund_cases
       SET status = 'refund_failed',
           refund_failure_reason = COALESCE($2, refund_failure_reason),
           updated_at = NOW()
       WHERE id = $1::uuid AND status IN ('refund_processing', 'approved')`,
      [caseId, params.failureReason || 'Razorpay refund failed'],
    );
    return { updated: true, caseId };
  }

  if (params.webhookStatus === 'processing') {
    if (['refund_processing', 'refunded'].includes(currentStatus)) {
      return { updated: false, caseId };
    }
    await query(
      `UPDATE meal_refund_cases SET status = 'refund_processing', updated_at = NOW()
       WHERE id = $1::uuid AND status IN ('approved', 'pending_review')`,
      [caseId],
    );
    return { updated: true, caseId };
  }

  if (currentStatus === 'refunded') return { updated: false, caseId };

  const upd = await query(
    `UPDATE meal_refund_cases
     SET status = 'refunded',
         refund_completed_at = COALESCE(refund_completed_at, NOW()),
         razorpay_refund_id = COALESCE(razorpay_refund_id, $2),
         updated_at = NOW()
     WHERE id = $1::uuid AND status IN ('refund_processing', 'approved')
     RETURNING id::text`,
    [caseId, rzId || null],
  );
  if (!upd.rows?.length) return { updated: false, caseId };

  await query(
    `UPDATE meal_orders SET payment_status = 'refunded', updated_at = NOW()
     WHERE id = $1::uuid AND payment_status = 'paid'`,
    [caseRow.meal_order_id],
  );

  const amount = parseFloat(String(caseRow.refund_amount_executed ?? '')) || undefined;
  if (caseRow.customer_id) {
    await notifyMealRefundCompleted({
      caseId,
      mealOrderId: String(caseRow.meal_order_id),
      customerId: String(caseRow.customer_id),
      orderNumber: caseRow.order_number ? String(caseRow.order_number) : undefined,
      vendorName: caseRow.vendor_name ? String(caseRow.vendor_name) : undefined,
      amount,
    });
  }

  return { updated: true, caseId };
}

export async function approveAndExecuteMealRefundCase(
  caseId: string,
  reviewedBy: string,
): Promise<MealRefundCaseExecutionResult> {
  const row = await loadCaseForExecution(caseId);
  if (!row) return { ok: false, error: 'case_not_found' };

  const status = String(row.status || '');
  if (status === 'refund_processing' || status === 'refunded') {
    return {
      ok: false,
      error: 'already_processing_or_refunded',
      alreadyProcessed: true,
      status,
    };
  }
  const canApprove = status === 'pending_review' || status === 'refund_failed';
  if (!canApprove) {
    return { ok: false, error: 'case_not_found_or_not_pending' };
  }

  const ctx = {
    id: String(row.meal_order_id),
    payment_status: String(row.payment_status ?? ''),
    cancelled_by: row.cancelled_by != null ? String(row.cancelled_by) : null,
    total_amount: parseFloat(String(row.total_amount ?? '0')) || 0,
    picked_up_at: row.picked_up_at ? String(row.picked_up_at) : null,
    delivered_at: row.delivered_at ? String(row.delivered_at) : null,
    payment_amount: row.payment_amount != null ? parseFloat(String(row.payment_amount)) : null,
    tracking_status: row.tracking_status != null ? String(row.tracking_status) : null,
  };

  if (!isMealOrderPaidForRefund(ctx)) {
    return { ok: false, error: 'order_not_paid' };
  }

  const ps = String(row.payment_status || '').toLowerCase();
  if (ps === 'refunded') {
    return { ok: false, error: 'order_already_refunded', alreadyProcessed: true };
  }

  let refundAmount = round2(parseFloat(String(row.recommended_refund_amount ?? '0')) || 0);
  if (refundAmount <= 0.009) {
    const rec = computeMealRefundRecommendation(ctx, {
      cancellationSource:
        row.cancellation_source != null ? String(row.cancellation_source) : null,
    });
    refundAmount = round2(rec?.recommendedRefundAmount ?? 0);
    if (refundAmount > 0.009 && rec) {
      await query(
        `UPDATE meal_refund_cases
         SET recommended_refund_amount = $2,
             recommendation_reason = $3,
             updated_at = NOW()
         WHERE id = $1::uuid`,
        [caseId, refundAmount, rec.recommendationReason],
      );
    }
  }
  if (refundAmount <= 0.009) {
    return { ok: false, error: 'invalid_refund_amount' };
  }

  const lock = await query(
    `UPDATE meal_refund_cases
     SET status = 'refund_processing',
         reviewed_by = $2,
         reviewed_at = NOW(),
         refund_requested_at = NOW(),
         refund_failure_reason = NULL,
         updated_at = NOW()
     WHERE id = $1::uuid AND status IN ('pending_review', 'refund_failed')
     RETURNING id::text, meal_order_id::text`,
    [caseId, reviewedBy],
  );
  if (!lock.rows?.length) {
    return { ok: false, error: 'case_not_found_or_not_pending' };
  }

  const mealOrderId = String(lock.rows[0].meal_order_id);
  const reason =
    String(row.cancellation_reason || '').trim() ||
    'Admin approved meal logistics refund';

  try {
    const result = await processMealOrderAdminOriginalRefund(mealOrderId, refundAmount, reason, {
      mealRefundCaseId: caseId,
      initiatedBy: 'admin',
    });

    if (result.alreadyProcessed) {
      return {
        ok: true,
        alreadyProcessed: true,
        status: 'refund_processing',
        refundsRowId: result.refundId,
        razorpayRefundId: result.razorpayRefundId,
        refundAmountExecuted: result.totalAmount,
      };
    }

    const terminalStatus =
      result.status === 'completed' || result.status === 'wallet_only'
        ? 'refunded'
        : 'refund_processing';
    const payoutMethod =
      result.razorpayAmount > 0.009
        ? 'original_payment'
        : result.walletCredited > 0.009
          ? 'wallet'
          : 'original_payment';

    await query(
      `UPDATE meal_refund_cases
       SET status = $2,
           refunds_row_id = COALESCE($3::uuid, refunds_row_id),
           razorpay_refund_id = COALESCE($4, razorpay_refund_id),
           refund_amount_executed = $5,
           payout_method = $6,
           refund_completed_at = CASE WHEN $2 = 'refunded' THEN NOW() ELSE refund_completed_at END,
           updated_at = NOW()
       WHERE id = $1::uuid`,
      [
        caseId,
        terminalStatus,
        result.refundId || null,
        result.razorpayRefundId || null,
        round2(result.totalAmount || refundAmount),
        payoutMethod,
      ],
    );

    const meta = await query(
      `SELECT mo.customer_id::text, mo.order_number, v.business_name AS vendor_name
       FROM meal_orders mo
       LEFT JOIN vendors v ON v.id = mo.vendor_id
       WHERE mo.id = $1::uuid LIMIT 1`,
      [mealOrderId],
    );
    const m = meta.rows?.[0] as Record<string, unknown> | undefined;
    if (m?.customer_id) {
      await notifyMealRefundApproved({
        caseId,
        mealOrderId,
        customerId: String(m.customer_id),
        orderNumber: m.order_number ? String(m.order_number) : undefined,
        vendorName: m.vendor_name ? String(m.vendor_name) : undefined,
        amount: round2(result.totalAmount || refundAmount),
      });
    }

    if (terminalStatus === 'refunded') {
      await query(
        `UPDATE meal_orders SET payment_status = 'refunded', updated_at = NOW() WHERE id = $1::uuid`,
        [mealOrderId],
      );
    }

    return {
      ok: true,
      status: terminalStatus,
      refundsRowId: result.refundId,
      razorpayRefundId: result.razorpayRefundId,
      refundAmountExecuted: round2(result.totalAmount || refundAmount),
    };
  } catch (e: unknown) {
    const msg = (e as Error).message || 'Refund execution failed';
    await query(
      `UPDATE meal_refund_cases
       SET status = 'refund_failed',
           refund_failure_reason = $2,
           updated_at = NOW()
       WHERE id = $1::uuid AND status = 'refund_processing'`,
      [caseId, msg.slice(0, 500)],
    );
    return { ok: false, error: msg, status: 'refund_failed' };
  }
}
