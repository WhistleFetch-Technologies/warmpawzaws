import { query } from '../../../../database/rds-connection';

export interface VendorFeedbackSourceRow {
  vendor_id: string;
  booking_id: string | null;
  payment_id: string | null;
  txn_at: string | Date | null;
  booking_style: string | null;
}

/** Completed booking owned by the customer, or null. */
export async function dbFindVendorFeedbackBooking(
  customerId: string,
  bookingId: string
): Promise<VendorFeedbackSourceRow | null> {
  const result = await query(
    `SELECT b.vendor_id, b.id AS booking_id, NULL::uuid AS payment_id, b.completed_at AS txn_at,
            NULLIF(COALESCE(b.service_style, b.service_type), '') AS booking_style
     FROM bookings b
     WHERE b.id = $1::uuid AND b.customer_id = $2::uuid AND b.status = 'completed'`,
    [bookingId, customerId]
  );
  return (result.rows[0] as VendorFeedbackSourceRow | undefined) ?? null;
}

/** Completed Warmpawz Pay bill owned by the customer (with its booking style if it paid for one), or null. */
export async function dbFindVendorFeedbackPayment(
  customerId: string,
  paymentId: string
): Promise<VendorFeedbackSourceRow | null> {
  const result = await query(
    `SELECT p.vendor_id, p.booking_id, p.id AS payment_id, p.completed_at AS txn_at,
            NULLIF(COALESCE(b.service_style, b.service_type), '') AS booking_style
     FROM payments p
     LEFT JOIN bookings b ON b.id = p.booking_id
     WHERE p.id = $1::uuid AND p.customer_id = $2::uuid
       AND p.payment_source = 'warmpawz_pay' AND p.payment_status = 'completed'`,
    [paymentId, customerId]
  );
  return (result.rows[0] as VendorFeedbackSourceRow | undefined) ?? null;
}
