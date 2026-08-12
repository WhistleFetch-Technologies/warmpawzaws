import { query, select, insert, update } from '../../../../database/rds-connection';

export type BookingRefundSummaryRow = {
  booking_id: string;
  amount: string;
  status: string;
  method: string | null;
};

export async function dbCustomerCustomeridBookingsGet0(customerId) {
  return await select('customers', { phone: customerId });
}

export async function dbCustomerCustomeridBookingsGet1(bookingQuery, params) {
  return await query(bookingQuery, params);
}

export async function dbCustomerCustomeridBookingsGet2(customerId) {
  return await query(
        `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
           COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
           COUNT(*) FILTER (WHERE status = 'completed') as completed,
           COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
         FROM bookings
         WHERE customer_id = $1`,
        [customerId]
      );
}

/** Aggregate refund rows for booking list cards. */
export async function dbRefundSummariesForBookingIds(
  bookingIds: string[]
): Promise<BookingRefundSummaryRow[]> {
  const ids = [...new Set(bookingIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];
  const res = await query(
    `SELECT
       booking_id::text AS booking_id,
       COALESCE(SUM(refund_amount::numeric), 0)::text AS amount,
       CASE
         WHEN bool_or(LOWER(COALESCE(refund_status, '')) = 'failed') THEN 'failed'
         WHEN bool_or(LOWER(COALESCE(refund_status, '')) IN ('processing', 'approved')) THEN 'processing'
         WHEN bool_or(LOWER(COALESCE(refund_status, '')) IN ('completed', 'processed')) THEN 'completed'
         ELSE COALESCE(MAX(refund_status), 'processing')
       END AS status,
       (ARRAY_AGG(refund_method ORDER BY requested_at DESC NULLS LAST))[1]::text AS method
     FROM refunds
     WHERE booking_id = ANY($1::uuid[])
       AND LOWER(COALESCE(refund_status, '')) IN (
         'completed', 'processing', 'approved', 'processed', 'failed'
       )
     GROUP BY booking_id`,
    [ids]
  );
  return ((res as any).rows || []) as BookingRefundSummaryRow[];
}

