import { query } from '../../../../database/rds-connection';
import { ymdInIst } from '../../../../utils/ist-scheduling';
import { WAPPT_BOOKING_MODE } from '../../../warmpawz-appointments/shared/wappt-booking-preflight';

export type WpayWapptBookingContextRow = {
  id: string;
  vendor_id: string;
  customer_id: string;
  status: string;
  booking_date: string | null;
  booking_time: string | null;
  booking_datetime: string | null;
  service_type: string | null;
  service_category: string | null;
  commerce_mode: string | null;
  total_amount: string | number | null;
  payment_status: string | null;
  otp_code: string | null;
  otp_verified: boolean | null;
  business_name: string | null;
  owner_name: string | null;
};

const BOOKING_SELECT = `
  SELECT b.id,
         b.vendor_id,
         b.customer_id,
         b.status,
         b.booking_date,
         b.booking_time,
         b.booking_datetime,
         b.service_type,
         b.service_category,
         b.commerce_mode,
         b.total_amount,
         b.payment_status,
         b.otp_code,
         b.otp_verified,
         v.business_name,
         v.owner_name
  FROM bookings b
  INNER JOIN vendors v ON v.id = b.vendor_id
`;

const WAPPT_FILTER = `
  b.commerce_mode = $3
  AND b.customer_id = $1::uuid
  AND b.vendor_id = $2::uuid
  AND NOT EXISTS (
    SELECT 1 FROM warmpawz_pay_appointment_credits c WHERE c.booking_id = b.id
  )
`;

export async function dbFindOpenWapptBookingForPay(
  customerId: string,
  vendorId: string,
): Promise<WpayWapptBookingContextRow | null> {
  const result = await query(
    `${BOOKING_SELECT}
     WHERE ${WAPPT_FILTER}
       AND b.status NOT IN ('cancelled', 'completed', 'refunded')
     ORDER BY COALESCE(b.booking_datetime, b.created_at) DESC
     LIMIT 1`,
    [customerId, vendorId, WAPPT_BOOKING_MODE],
  );
  return (result.rows[0] as WpayWapptBookingContextRow | undefined) ?? null;
}

export async function dbFindCreditEligibleWapptBookingForPay(
  customerId: string,
  vendorId: string,
): Promise<WpayWapptBookingContextRow | null> {
  const today = ymdInIst();
  const result = await query(
    `${BOOKING_SELECT}
     WHERE ${WAPPT_FILTER}
       AND b.booking_date = $4::date
       AND b.status NOT IN ('cancelled', 'completed', 'refunded')
     ORDER BY COALESCE(b.booking_datetime, b.created_at) DESC
     LIMIT 1`,
    [customerId, vendorId, WAPPT_BOOKING_MODE, today],
  );
  return (result.rows[0] as WpayWapptBookingContextRow | undefined) ?? null;
}

export async function dbCompleteWapptBookingAfterPayBill(bookingId: string): Promise<boolean> {
  const result = await query(
    `UPDATE bookings
     SET status = 'completed',
         completed_at = COALESCE(completed_at, NOW()),
         updated_at = NOW()
     WHERE id = $1::uuid
       AND commerce_mode = $2
       AND status NOT IN ('cancelled', 'completed', 'refunded')
     RETURNING id`,
    [bookingId, WAPPT_BOOKING_MODE],
  );
  return Boolean(result.rows?.length);
}

export async function dbLoadWapptBookingForPayCredit(
  bookingId: string,
  customerId: string,
  vendorId: string,
): Promise<WpayWapptBookingContextRow | null> {
  const result = await query(
    `${BOOKING_SELECT}
     WHERE b.id = $1::uuid
       AND b.customer_id = $2::uuid
       AND b.vendor_id = $3::uuid
       AND b.commerce_mode = $4
     LIMIT 1`,
    [bookingId, customerId, vendorId, WAPPT_BOOKING_MODE],
  );
  return (result.rows[0] as WpayWapptBookingContextRow | undefined) ?? null;
}

export async function dbIsAppointmentCreditConsumed(bookingId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM warmpawz_pay_appointment_credits WHERE booking_id = $1::uuid LIMIT 1`,
    [bookingId],
  );
  return Boolean(result.rows?.length);
}

export async function dbConsumeAppointmentCredit(params: {
  bookingId: string;
  paymentId: string;
  amount: number;
}): Promise<boolean> {
  const result = await query(
    `INSERT INTO warmpawz_pay_appointment_credits (booking_id, payment_id, amount)
     VALUES ($1::uuid, $2::uuid, $3::numeric)
     ON CONFLICT (booking_id) DO NOTHING
     RETURNING booking_id`,
    [params.bookingId, params.paymentId, params.amount],
  );
  return Boolean(result.rows?.length);
}
