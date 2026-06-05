/**
 * Meal refund review cases (Phase 2 — Pidge logistics cancel).
 *
 * Reusable refund execution (DO NOT invoke from this module):
 * - `payments/meal-order-original-refund.ts` — Razorpay + wallet refunds for meal_orders;
 *   uses `payments` (transaction_id `meal_order:{id}`) and `refunds` rows (mirrors booking-original-refund).
 * - `meal-subscription-refund.ts` / `meal-subscription-parent-booking-refund.ts` — subscription paths.
 *
 * Creates `meal_refund_cases`; approve runs Razorpay via meal-refund-case-execution (Phase 3).
 */

import { query, insert } from '../database/rds-connection';
import { notifyMealEvent } from './meal-delivery-notifications';

export type MealRefundCaseStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'refund_processing'
  | 'refunded'
  | 'refund_failed';

export type MealRefundReviewCustomerMetadata = {
  status: MealRefundCaseStatus;
  message: string;
  recommendedAmount?: number;
  createdAt?: string;
};

const CUSTOMER_STATUS_MESSAGES: Record<MealRefundCaseStatus, string> = {
  pending_review: 'Our team is reviewing your refund request.',
  approved: 'Your refund has been approved and is being processed.',
  rejected: 'Please contact support regarding your refund request.',
  refund_processing: 'Your refund is being processed to your original payment method.',
  refunded: 'Your refund has been completed.',
  refund_failed: 'We could not complete your refund automatically. Please contact support.',
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type PidgeCancelCaseInput = {
  mealOrderId: string;
  pidgeOrderId?: string | null;
  cancellationReason?: string | null;
  webhookEventId?: string | null;
};

export type MealRefundRecommendation = {
  recommendedRefundAmount: number;
  recommendationReason: string;
};

type MealOrderRefundContext = {
  id: string;
  payment_status: string;
  cancelled_by: string | null;
  total_amount: number;
  picked_up_at: string | null;
  delivered_at: string | null;
  payment_amount: number | null;
  tracking_status: string | null;
};

const TERMINAL_TRACKING = new Set(['delivered', 'picked_up']);

/** Paid meal order — align with payments join and prod meal_orders values. */
export function isMealOrderPaidForRefund(ctx: MealOrderRefundContext): boolean {
  const ps = String(ctx.payment_status || '').trim().toLowerCase();
  if (ps === 'paid' || ps === 'completed') return true;
  return (ctx.payment_amount ?? 0) > 0;
}

async function loadMealOrderRefundContext(mealOrderId: string): Promise<MealOrderRefundContext | null> {
  const res = await query(
    `SELECT mo.id::text,
            mo.payment_status,
            mo.cancelled_by,
            mo.total_amount::text,
            mo.picked_up_at,
            mo.delivered_at,
            dt.status AS tracking_status,
            p.amount::text AS payment_amount
     FROM meal_orders mo
     LEFT JOIN delivery_tracking dt ON dt.meal_order_id = mo.id
     LEFT JOIN payments p ON p.transaction_id = 'meal_order:' || mo.id::text
       AND p.payment_status IN ('completed', 'paid')
     WHERE mo.id = $1::uuid
     ORDER BY dt.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST
     LIMIT 1`,
    [mealOrderId],
  );
  const row = res.rows?.[0] as Record<string, unknown> | undefined;
  if (!row?.id) return null;
  return {
    id: String(row.id),
    payment_status: String(row.payment_status ?? ''),
    cancelled_by: row.cancelled_by != null ? String(row.cancelled_by) : null,
    total_amount: parseFloat(String(row.total_amount ?? '0')) || 0,
    picked_up_at: row.picked_up_at ? String(row.picked_up_at) : null,
    delivered_at: row.delivered_at ? String(row.delivered_at) : null,
    payment_amount: row.payment_amount != null ? parseFloat(String(row.payment_amount)) : null,
    tracking_status: row.tracking_status != null ? String(row.tracking_status) : null,
  };
}

export function computeMealRefundRecommendation(
  ctx: MealOrderRefundContext,
  options?: { cancellationSource?: string | null },
): MealRefundRecommendation | null {
  const paidTotal = round2(
    ctx.payment_amount != null && ctx.payment_amount > 0
      ? ctx.payment_amount
      : ctx.total_amount,
  );
  if (paidTotal <= 0) return null;

  const tracking = (ctx.tracking_status ?? '').trim().toLowerCase();
  const neverDelivered =
    !ctx.delivered_at &&
    !ctx.picked_up_at &&
    (!tracking || !TERMINAL_TRACKING.has(tracking));

  const logisticsCancel =
    ctx.cancelled_by === 'system_pidge' ||
    options?.cancellationSource === 'system_pidge';

  if (logisticsCancel && neverDelivered) {
    return {
      recommendedRefundAmount: paidTotal,
      recommendationReason:
        'Pidge logistics cancelled before pickup/delivery; recommend 100% of customer-paid total.',
    };
  }

  return {
    recommendedRefundAmount: 0,
    recommendationReason:
      'No automatic full-refund rule matched; manual review required.',
  };
}

export async function getMealRefundReviewCustomerMetadata(
  mealOrderId: string,
): Promise<MealRefundReviewCustomerMetadata | null> {
  let res: { rows?: Record<string, unknown>[] };
  try {
    res = await query(
      `SELECT status,
              recommended_refund_amount::text,
              refund_amount_executed::text,
              created_at
       FROM meal_refund_cases
       WHERE meal_order_id = $1::uuid
       LIMIT 1`,
      [mealOrderId],
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/meal_refund_cases|does not exist|undefined_table/i.test(msg)) {
      return null;
    }
    throw e;
  }
  const row = res.rows?.[0] as Record<string, unknown> | undefined;
  if (!row?.status) return null;
  const status = String(row.status) as MealRefundCaseStatus;
  const recommended = parseFloat(String(row.recommended_refund_amount ?? ''));
  const executed = parseFloat(String(row.refund_amount_executed ?? ''));
  const displayAmount =
    ['refund_processing', 'refunded'].includes(status) && executed > 0
      ? executed
      : recommended;
  const createdAt = row.created_at != null ? String(row.created_at) : undefined;
  return {
    status,
    message: CUSTOMER_STATUS_MESSAGES[status] ?? CUSTOMER_STATUS_MESSAGES.pending_review,
    ...(Number.isFinite(displayAmount) && displayAmount > 0
      ? { recommendedAmount: round2(displayAmount) }
      : {}),
    ...(createdAt ? { createdAt } : {}),
  };
}

async function notifyMealRefundCaseCreated(params: {
  mealOrderId: string;
  orderNumber?: string;
  customerId: string;
  vendorName?: string;
  dedupeKey: string;
}): Promise<void> {
  await notifyMealEvent({
    recipientId: params.customerId,
    recipientType: 'customer',
    eventType: 'meal_refund_review_initiated',
    orderId: params.mealOrderId,
    dedupeScopeId: params.dedupeKey,
    orderNumber: params.orderNumber,
    vendorName: params.vendorName,
  }).catch((e) =>
    console.warn('[meal-refund-case] customer notify failed:', (e as Error).message),
  );

  await insert('notifications', {
    recipient_id: null,
    recipient_type: 'admin',
    title: 'Meal refund review required',
    message: `Pidge cancelled paid meal order ${params.orderNumber || params.mealOrderId.slice(0, 8)} — review refund case.`,
    notification_type: 'meal_refund_case_created',
    channels: { email: false, sms: false, inApp: true, push: false },
    is_read: false,
    data: {
      mealOrderId: params.mealOrderId,
      dedupeKey: `${params.dedupeKey}:admin`,
      eventType: 'meal_refund_case_created',
    },
  }).catch((e) =>
    console.warn('[meal-refund-case] admin notify failed:', (e as Error).message),
  );
}

/**
 * Idempotent case creation after Pidge cancel (paid orders only).
 */
export async function createMealRefundCaseOnPidgeCancel(
  input: PidgeCancelCaseInput,
): Promise<{ created: boolean; caseId?: string; skipped?: string }> {
  const mealOrderId = String(input.mealOrderId || '').trim();
  if (!mealOrderId) return { created: false, skipped: 'missing_meal_order_id' };

  const ctx = await loadMealOrderRefundContext(mealOrderId);
  if (!ctx) return { created: false, skipped: 'order_not_found' };

  if (!isMealOrderPaidForRefund(ctx)) {
    return { created: false, skipped: 'not_paid' };
  }

  const recommendation = computeMealRefundRecommendation(ctx, {
    cancellationSource: 'system_pidge',
  });
  const dedupeKey = `meal_refund_case:${mealOrderId}`;

  const ins = await query(
    `INSERT INTO meal_refund_cases (
       meal_order_id, pidge_order_id, status, cancellation_source, cancellation_reason,
       recommended_refund_amount, recommendation_reason, pidge_webhook_event_id,
       notification_dedupe_key, created_at, updated_at
     ) VALUES (
       $1::uuid, $2, 'pending_review', 'system_pidge', $3,
       $4, $5, $6::uuid,
       $7, NOW(), NOW()
     )
     ON CONFLICT (meal_order_id) DO NOTHING
     RETURNING id::text`,
    [
      mealOrderId,
      input.pidgeOrderId?.trim() || null,
      input.cancellationReason?.trim() || null,
      recommendation?.recommendedRefundAmount ?? null,
      recommendation?.recommendationReason ?? null,
      input.webhookEventId?.trim() || null,
      dedupeKey,
    ],
  );

  const caseId = ins.rows?.[0]?.id ? String(ins.rows[0].id) : undefined;
  if (!caseId) {
    return { created: false, skipped: 'duplicate_case' };
  }

  const meta = await query(
    `SELECT mo.order_number, mo.customer_id::text, v.business_name AS vendor_name
     FROM meal_orders mo
     LEFT JOIN vendors v ON v.id = mo.vendor_id
     WHERE mo.id = $1::uuid
     LIMIT 1`,
    [mealOrderId],
  );
  const row = meta.rows?.[0] as Record<string, unknown> | undefined;
  if (row?.customer_id) {
    await notifyMealRefundCaseCreated({
      mealOrderId,
      orderNumber: row.order_number ? String(row.order_number) : undefined,
      customerId: String(row.customer_id),
      vendorName: row.vendor_name ? String(row.vendor_name) : undefined,
      dedupeKey,
    });
  }

  return { created: true, caseId };
}

export async function listMealRefundCases(params: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ cases: Record<string, unknown>[]; total: number }> {
  const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.status?.trim()) {
    conditions.push(`mrc.status = $${idx++}`);
    values.push(params.status.trim());
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await query(
    `SELECT COUNT(*)::text AS total FROM meal_refund_cases mrc ${where}`,
    values,
  );
  const total = parseInt(String(countRes.rows?.[0]?.total ?? '0'), 10) || 0;

  values.push(limit, offset);
  const listRes = await query(
    `SELECT mrc.id::text, mrc.meal_order_id::text, mrc.pidge_order_id, mrc.status,
            mrc.cancellation_source, mrc.cancellation_reason,
            mrc.recommended_refund_amount::text, mrc.recommendation_reason,
            mrc.reviewed_by, mrc.reviewed_at, mrc.created_at, mrc.updated_at,
            mrc.refunds_row_id::text, mrc.razorpay_refund_id, mrc.refund_amount_executed::text,
            mrc.refund_requested_at, mrc.refund_completed_at, mrc.refund_failure_reason,
            mrc.payout_method,
            mo.order_number, mo.payment_status, mo.total_amount::text,
            c.full_name AS customer_name, v.business_name AS vendor_name
     FROM meal_refund_cases mrc
     JOIN meal_orders mo ON mo.id = mrc.meal_order_id
     LEFT JOIN customers c ON c.id = mo.customer_id
     LEFT JOIN vendors v ON v.id = mo.vendor_id
     ${where}
     ORDER BY mrc.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    values,
  );

  return { cases: (listRes.rows ?? []) as Record<string, unknown>[], total };
}

export async function getMealRefundCaseDetail(caseId: string): Promise<Record<string, unknown> | null> {
  const res = await query(
    `SELECT mrc.*,
            mo.order_number, mo.status AS order_status, mo.payment_status,
            mo.total_amount::text, mo.cancelled_by, mo.cancellation_reason AS order_cancellation_reason,
            mo.customer_id::text, mo.vendor_id::text,
            c.full_name AS customer_name, c.phone AS customer_phone,
            v.business_name AS vendor_name,
            p.amount::text AS payment_amount, p.payment_status AS gateway_payment_status,
            p.razorpay_payment_id,
            phe.id::text AS webhook_event_id, phe.processed_at AS webhook_processed_at
     FROM meal_refund_cases mrc
     JOIN meal_orders mo ON mo.id = mrc.meal_order_id
     LEFT JOIN customers c ON c.id = mo.customer_id
     LEFT JOIN vendors v ON v.id = mo.vendor_id
     LEFT JOIN payments p ON p.transaction_id = 'meal_order:' || mo.id::text
     LEFT JOIN pidge_hyperlocal_webhook_events phe ON phe.id = mrc.pidge_webhook_event_id
     WHERE mrc.id = $1::uuid
     LIMIT 1`,
    [caseId],
  );
  const row = res.rows?.[0];
  return row ? (row as Record<string, unknown>) : null;
}

export async function approveMealRefundCase(
  caseId: string,
  reviewedBy: string,
): Promise<{
  ok: boolean;
  error?: string;
  status?: string;
  refundsRowId?: string;
  razorpayRefundId?: string;
  refundAmountExecuted?: number;
  alreadyProcessed?: boolean;
}> {
  const { approveAndExecuteMealRefundCase } = await import('./meal-refund-case-execution');
  return approveAndExecuteMealRefundCase(caseId, reviewedBy);
}

export async function rejectMealRefundCase(
  caseId: string,
  reviewedBy: string,
  reviewNotes?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const res = await query(
    `UPDATE meal_refund_cases
     SET status = 'rejected',
         reviewed_by = $2,
         reviewed_at = NOW(),
         review_notes = COALESCE($3, review_notes),
         updated_at = NOW()
     WHERE id = $1::uuid AND status = 'pending_review'
     RETURNING id::text`,
    [caseId, reviewedBy, reviewNotes?.trim() || null],
  );
  if (!res.rows?.length) {
    return { ok: false, error: 'case_not_found_or_not_pending' };
  }
  return { ok: true };
}

/**
 * Admin backfill: create review case for an already-cancelled paid meal order.
 */
export async function backfillMealRefundCaseByOrderRef(
  orderRef: string,
): Promise<{ created: boolean; caseId?: string; skipped?: string; mealOrderId?: string }> {
  const ref = String(orderRef || '').trim();
  if (!ref) return { created: false, skipped: 'missing_order_ref' };

  const orderRes = await query(
    `SELECT mo.id::text,
            mo.order_number,
            mo.status,
            mo.payment_status,
            mo.cancellation_reason,
            mo.cancelled_by,
            mo.pidge_order_id,
            (
              SELECT phe.id::text
              FROM pidge_hyperlocal_webhook_events phe
              WHERE phe.meal_order_id = mo.id
                AND phe.event_kind = 'meal_cancelled'
              ORDER BY phe.created_at DESC
              LIMIT 1
            ) AS webhook_event_id
     FROM meal_orders mo
     WHERE mo.order_number = $1 OR mo.id::text = $1
     ORDER BY mo.created_at DESC
     LIMIT 1`,
    [ref],
  );
  const row = orderRes.rows?.[0] as Record<string, unknown> | undefined;
  if (!row?.id) return { created: false, skipped: 'order_not_found' };

  const mealOrderId = String(row.id);
  if (String(row.status || '').toLowerCase() !== 'cancelled') {
    return { created: false, skipped: 'order_not_cancelled', mealOrderId };
  }

  const result = await createMealRefundCaseOnPidgeCancel({
    mealOrderId,
    pidgeOrderId: row.pidge_order_id != null ? String(row.pidge_order_id) : null,
    cancellationReason:
      row.cancellation_reason != null
        ? String(row.cancellation_reason)
        : 'Pidge logistics cancellation (admin backfill)',
    webhookEventId: row.webhook_event_id != null ? String(row.webhook_event_id) : null,
  });
  return { ...result, mealOrderId };
}
