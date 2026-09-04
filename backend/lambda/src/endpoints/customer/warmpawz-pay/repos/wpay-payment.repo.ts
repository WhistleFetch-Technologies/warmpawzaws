import { query } from '../../../../database/rds-connection';

export type WpayPaymentRow = {
  id: string;
  customer_id: string;
  vendor_id: string | null;
  booking_id: string | null;
  amount: string | number;
  original_amount: string | number | null;
  discount_amount: string | number | null;
  payment_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  metadata: Record<string, unknown> | null;
  completed_at: string | null;
  created_at: string;
};

export async function dbWpayPaymentByIdForCustomer(
  paymentId: string,
  customerId: string,
): Promise<WpayPaymentRow | null> {
  const result = await query(
    `SELECT id, customer_id, vendor_id, booking_id, amount, original_amount, discount_amount,
            payment_status, razorpay_order_id, razorpay_payment_id, razorpay_signature,
            metadata, completed_at, created_at
     FROM payments
     WHERE id = $1::uuid
       AND customer_id = $2::uuid
       AND payment_source = 'warmpawz_pay'
     LIMIT 1`,
    [paymentId, customerId],
  );
  return (result.rows[0] as WpayPaymentRow | undefined) ?? null;
}

export async function dbWpayCompletePayment(params: {
  paymentId: string;
  customerId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  originalAmount: number;
  discountAmount: number;
}): Promise<WpayPaymentRow | null> {
  const result = await query(
    `UPDATE payments
     SET payment_status = 'completed',
         razorpay_payment_id = $3,
         razorpay_signature = $4,
         original_amount = $5,
         discount_amount = $6,
         completed_at = COALESCE(completed_at, NOW()),
         updated_at = NOW()
     WHERE id = $1::uuid
       AND customer_id = $2::uuid
       AND payment_source = 'warmpawz_pay'
       AND payment_status IN ('pending', 'processing', 'completed')
     RETURNING id, customer_id, vendor_id, booking_id, amount, original_amount, discount_amount,
               payment_status, razorpay_order_id, razorpay_payment_id, razorpay_signature,
               metadata, completed_at, created_at`,
    [
      params.paymentId,
      params.customerId,
      params.razorpayPaymentId,
      params.razorpaySignature,
      params.originalAmount,
      params.discountAmount,
    ],
  );
  return (result.rows[0] as WpayPaymentRow | undefined) ?? null;
}

export type WpayTransactionDbRow = {
  payment_id: string;
  vendor_id: string;
  business_name: string | null;
  owner_name: string | null;
  vendor_type: string | null;
  original_amount: string | number;
  discount_amount: string | number;
  payable_amount: string | number;
  discount_percent: string | number | null;
  paid_at: string;
  metadata: Record<string, unknown> | null;
};
export async function dbWpayTransactionsPage(params: {
  customerId: string;
  limit: number;
  cursor: string | null;
}): Promise<{ rows: WpayTransactionDbRow[]; nextCursor: string | null }> {
  const { customerId, limit, cursor } = params;
  const values: unknown[] = [customerId, limit + 1];
  let cursorSql = '';
  if (cursor) {
    const parts = cursor.split('|');
    const paidAt = parts[0];
    const paymentId = parts[1];
    if (paidAt && paymentId) {
      cursorSql = `AND (p.completed_at, p.id) < ($3::timestamptz, $4::uuid)`;
      values.push(paidAt, paymentId);
    }
  }

  const result = await query(
    `SELECT
       p.id AS payment_id,
       p.vendor_id,
       v.business_name,
       v.owner_name,
       v.vendor_type,
       p.original_amount,
       p.discount_amount,
       p.amount AS payable_amount,
       (p.metadata->>'quotedDiscountPercent')::numeric AS discount_percent,
       p.completed_at AS paid_at,
       p.metadata
     FROM payments p
     INNER JOIN vendors v ON v.id = p.vendor_id     WHERE p.customer_id = $1::uuid
       AND p.payment_source = 'warmpawz_pay'
       AND p.payment_status = 'completed'
       AND p.completed_at IS NOT NULL
       ${cursorSql}
     ORDER BY p.completed_at DESC, p.id DESC
     LIMIT $2`,
    values,
  );

  const rows = result.rows as WpayTransactionDbRow[];
  if (rows.length > limit) {
    const last = rows[limit - 1];
    const nextCursor = `${last.paid_at}|${last.payment_id}`;
    return { rows: rows.slice(0, limit), nextCursor };
  }
  return { rows, nextCursor: null };
}
