/**
 * Unified admin refund read-model (booking, meal_order, package — excludes shop/ecommerce).
 */

import { query } from '../database/rds-connection';

export type RefundHubSourceType = 'refund' | 'meal_case';
export type RefundHubDomain = 'booking' | 'meal_order' | 'package';
export type RefundHubStage =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'refund_processing'
  | 'refunded'
  | 'refund_failed'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export type RefundHubListItem = {
  sourceType: RefundHubSourceType;
  id: string;
  domain: RefundHubDomain;
  stage: RefundHubStage;
  origin: string | null;
  amount: number | null;
  payoutDestination: string | null;
  customerName: string | null;
  customerId: string | null;
  vendorName: string | null;
  referenceLabel: string | null;
  referenceId: string | null;
  reason: string | null;
  requestedAt: string | null;
  actedBy: string | null;
  actedAt: string | null;
  createdAt: string;
};

export type RefundHubDetail = RefundHubListItem & {
  raw: Record<string, unknown>;
  payment?: Record<string, unknown>;
  booking?: Record<string, unknown>;
  mealOrder?: Record<string, unknown>;
  mealCase?: Record<string, unknown>;
};

const ECOMMERCE_PAYMENT_EXCLUDE = `(
  COALESCE(p.order_id, p.pharmacy_order_id) IS NULL
)`;

export function mapRefundRowStatusToHubStage(status: string): RefundHubStage {
  const s = String(status || '').trim().toLowerCase();
  switch (s) {
    case 'pending':
      return 'pending';
    case 'approved':
      return 'approved';
    case 'processing':
    case 'processed':
      return 'refund_processing';
    case 'completed':
      return 'refunded';
    case 'rejected':
      return 'rejected';
    case 'failed':
      return 'refund_failed';
    default:
      return 'pending';
  }
}

export function mapMealCaseStatusToHubStage(status: string): RefundHubStage {
  const s = String(status || '').trim().toLowerCase();
  if (
    [
      'pending_review',
      'approved',
      'rejected',
      'refund_processing',
      'refunded',
      'refund_failed',
    ].includes(s)
  ) {
    return s as RefundHubStage;
  }
  return 'pending_review';
}

function inferRefundDomain(row: Record<string, unknown>): RefundHubDomain {
  const txn = String(row.transaction_id || '');
  if (txn.startsWith('meal_order:') || txn.startsWith('meal_subscription')) {
    return 'meal_order';
  }
  if (row.package_purchase_id) {
    return 'package';
  }
  if (row.booking_id) {
    return 'booking';
  }
  return 'booking';
}

function inferRefundOrigin(row: Record<string, unknown>): string | null {
  const reason = String(row.refund_reason || '').toLowerCase();
  if (reason.includes('pidge') || reason.includes('logistics')) return 'system_pidge';
  if (reason.includes('vendor')) return 'vendor';
  if (reason.includes('customer')) return 'customer';
  if (reason.includes('admin') || reason.includes('support')) return 'admin';
  const cancelledBy = row.cancelled_by != null ? String(row.cancelled_by) : null;
  if (cancelledBy) return cancelledBy;
  return row.initiated_by != null ? String(row.initiated_by) : null;
}

function inferPayoutDestination(row: Record<string, unknown>): string | null {
  const method = String(row.refund_method || '').toLowerCase();
  if (method === 'wallet') return 'wallet';
  if (method === 'original') return 'original_payment';
  if (row.payout_method) return String(row.payout_method);
  return method || null;
}

function rowToRefundListItem(row: Record<string, unknown>): RefundHubListItem {
  const domain = inferRefundDomain(row);
  const refId =
    domain === 'meal_order' && String(row.transaction_id || '').startsWith('meal_order:')
      ? String(row.transaction_id).replace('meal_order:', '')
      : row.booking_id
        ? String(row.booking_id)
        : row.package_purchase_id
          ? String(row.package_purchase_id)
          : null;

  return {
    sourceType: 'refund',
    id: String(row.id),
    domain,
    stage: mapRefundRowStatusToHubStage(String(row.refund_status || '')),
    origin: inferRefundOrigin(row),
    amount: parseFloat(String(row.refund_amount ?? '')) || null,
    payoutDestination: inferPayoutDestination(row),
    customerName: row.customer_name != null ? String(row.customer_name) : null,
    customerId: row.customer_id != null ? String(row.customer_id) : null,
    vendorName: row.vendor_name != null ? String(row.vendor_name) : null,
    referenceLabel:
      domain === 'meal_order'
        ? row.order_number != null
          ? String(row.order_number)
          : 'Meal order'
        : domain === 'package'
          ? row.package_name != null
            ? String(row.package_name)
            : 'Package'
          : 'Booking',
    referenceId: refId,
    reason: row.refund_reason != null ? String(row.refund_reason) : null,
    requestedAt: row.requested_at != null ? String(row.requested_at) : null,
    actedBy: row.processed_by != null ? String(row.processed_by) : null,
    actedAt:
      row.processed_at != null
        ? String(row.processed_at)
        : row.completed_at != null
          ? String(row.completed_at)
          : null,
    createdAt: String(row.requested_at || row.created_at || ''),
  };
}

function rowToMealCaseListItem(row: Record<string, unknown>): RefundHubListItem {
  const amount =
    row.refund_amount_executed != null
      ? parseFloat(String(row.refund_amount_executed))
      : parseFloat(String(row.recommended_refund_amount ?? ''));
  return {
    sourceType: 'meal_case',
    id: String(row.id),
    domain: 'meal_order',
    stage: mapMealCaseStatusToHubStage(String(row.status || '')),
    origin: row.cancellation_source != null ? String(row.cancellation_source) : null,
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    payoutDestination: row.payout_method != null ? String(row.payout_method) : null,
    customerName: row.customer_name != null ? String(row.customer_name) : null,
    customerId: row.customer_id != null ? String(row.customer_id) : null,
    vendorName: row.vendor_name != null ? String(row.vendor_name) : null,
    referenceLabel: row.order_number != null ? String(row.order_number) : 'Meal order',
    referenceId: row.meal_order_id != null ? String(row.meal_order_id) : null,
    reason:
      row.cancellation_reason != null
        ? String(row.cancellation_reason)
        : row.recommendation_reason != null
          ? String(row.recommendation_reason)
          : null,
    requestedAt: row.refund_requested_at != null ? String(row.refund_requested_at) : null,
    actedBy: row.reviewed_by != null ? String(row.reviewed_by) : null,
    actedAt: row.reviewed_at != null ? String(row.reviewed_at) : null,
    createdAt: String(row.created_at || ''),
  };
}

export async function listAdminRefundHubCases(params: {
  domain?: string;
  origin?: string;
  stage?: string;
  limit?: number;
  offset?: number;
}): Promise<{ cases: RefundHubListItem[]; total: number }> {
  const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);
  const stageFilter = params.stage?.trim().toLowerCase();
  const domainFilter = params.domain?.trim().toLowerCase();
  const originFilter = params.origin?.trim().toLowerCase();

  const refundRows = await query(
    `SELECT r.id::text, r.refund_status, r.refund_amount::text, r.refund_reason, r.refund_method,
            r.requested_at, r.processed_at, r.completed_at, r.razorpay_refund_id,
            r.customer_id::text, r.booking_id::text, r.meal_refund_case_id::text,
            COALESCE(c.full_name, c.name, '') AS customer_name,
            v.business_name AS vendor_name,
            p.transaction_id, p.order_id::text,
            b.package_purchase_id::text, b.cancelled_by,
            pp.package_name,
            mo.order_number
     FROM refunds r
     LEFT JOIN payments p ON p.id = r.payment_id
     LEFT JOIN customers c ON c.id = r.customer_id
     LEFT JOIN vendors v ON v.id = r.vendor_id
     LEFT JOIN bookings b ON b.id = r.booking_id
     LEFT JOIN package_purchases pp ON pp.id = b.package_purchase_id
     LEFT JOIN meal_orders mo ON p.transaction_id = 'meal_order:' || mo.id::text
     WHERE ${ECOMMERCE_PAYMENT_EXCLUDE}
       AND r.meal_refund_case_id IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM meal_refund_cases mrc WHERE mrc.refunds_row_id = r.id
       )
     ORDER BY r.requested_at DESC NULLS LAST
     LIMIT 500`,
    [],
  );

  const mealRows = await query(
    `SELECT mrc.id::text, mrc.meal_order_id::text, mrc.status, mrc.cancellation_source,
            mrc.cancellation_reason, mrc.recommended_refund_amount::text,
            mrc.recommendation_reason, mrc.reviewed_by, mrc.reviewed_at,
            mrc.refund_amount_executed::text, mrc.refund_requested_at, mrc.payout_method,
            mrc.created_at,
            mo.order_number, mo.customer_id::text,
            c.full_name AS customer_name, v.business_name AS vendor_name
     FROM meal_refund_cases mrc
     JOIN meal_orders mo ON mo.id = mrc.meal_order_id
     LEFT JOIN customers c ON c.id = mo.customer_id
     LEFT JOIN vendors v ON v.id = mo.vendor_id
     ORDER BY mrc.created_at DESC
     LIMIT 500`,
    [],
  );

  let merged: RefundHubListItem[] = [
    ...((refundRows.rows ?? []) as Record<string, unknown>[]).map(rowToRefundListItem),
    ...((mealRows.rows ?? []) as Record<string, unknown>[]).map(rowToMealCaseListItem),
  ];

  if (domainFilter) {
    merged = merged.filter((c) => c.domain === domainFilter);
  }
  if (originFilter) {
    merged = merged.filter(
      (c) => (c.origin || '').toLowerCase() === originFilter,
    );
  }
  if (stageFilter) {
    merged = merged.filter((c) => c.stage === stageFilter);
  }

  merged.sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );

  const total = merged.length;
  const cases = merged.slice(offset, offset + limit);
  return { cases, total };
}

export async function getAdminRefundHubDetail(
  sourceType: RefundHubSourceType,
  id: string,
): Promise<RefundHubDetail | null> {
  if (sourceType === 'meal_case') {
    const res = await query(
      `SELECT mrc.*,
              mo.order_number, mo.status AS order_status, mo.payment_status,
              mo.total_amount::text, mo.cancelled_by, mo.cancellation_reason AS order_cancellation_reason,
              c.full_name AS customer_name, c.phone AS customer_phone,
              v.business_name AS vendor_name,
              p.amount::text AS payment_amount, p.payment_status AS gateway_payment_status,
              p.razorpay_payment_id, p.transaction_id
       FROM meal_refund_cases mrc
       JOIN meal_orders mo ON mo.id = mrc.meal_order_id
       LEFT JOIN customers c ON c.id = mo.customer_id
       LEFT JOIN vendors v ON v.id = mo.vendor_id
       LEFT JOIN payments p ON p.transaction_id = 'meal_order:' || mo.id::text
       WHERE mrc.id = $1::uuid
       LIMIT 1`,
      [id],
    );
    const row = res.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const list = rowToMealCaseListItem(row);
    return {
      ...list,
      raw: row,
      mealOrder: {
        id: row.meal_order_id,
        orderNumber: row.order_number,
        orderStatus: row.order_status,
        paymentStatus: row.payment_status,
        totalAmount: row.total_amount,
      },
      mealCase: row,
      payment: row.razorpay_payment_id
        ? {
            amount: row.payment_amount,
            status: row.gateway_payment_status,
            razorpayPaymentId: row.razorpay_payment_id,
            transactionId: row.transaction_id,
          }
        : undefined,
    };
  }

  const res = await query(
    `SELECT r.*,
            COALESCE(c.full_name, c.name, '') AS customer_name,
            c.phone AS customer_phone,
            v.business_name AS vendor_name,
            p.transaction_id, p.razorpay_payment_id, p.amount::text AS payment_amount,
            p.payment_status AS gateway_payment_status, p.order_id::text,
            b.id::text AS booking_ref, b.status AS booking_status, b.package_purchase_id::text,
            b.cancelled_by, pp.package_name,
            mo.order_number, mo.id::text AS meal_order_id
     FROM refunds r
     LEFT JOIN payments p ON p.id = r.payment_id
     LEFT JOIN customers c ON c.id = r.customer_id
     LEFT JOIN vendors v ON v.id = r.vendor_id
     LEFT JOIN bookings b ON b.id = r.booking_id
     LEFT JOIN package_purchases pp ON pp.id = b.package_purchase_id
     LEFT JOIN meal_orders mo ON p.transaction_id = 'meal_order:' || mo.id::text
     WHERE r.id = $1::uuid AND ${ECOMMERCE_PAYMENT_EXCLUDE}
     LIMIT 1`,
    [id],
  );
  const row = res.rows?.[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const list = rowToRefundListItem(row);
  return {
    ...list,
    raw: row,
    payment: {
      id: row.payment_id,
      amount: row.payment_amount,
      status: row.gateway_payment_status,
      razorpayPaymentId: row.razorpay_payment_id,
      transactionId: row.transaction_id,
    },
    booking: row.booking_ref
      ? {
          id: row.booking_ref,
          status: row.booking_status,
          packagePurchaseId: row.package_purchase_id,
        }
      : undefined,
    mealOrder: row.meal_order_id
      ? { id: row.meal_order_id, orderNumber: row.order_number }
      : undefined,
  };
}
