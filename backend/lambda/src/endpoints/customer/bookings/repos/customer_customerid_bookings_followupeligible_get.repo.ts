import { query } from '../../../../database/rds-connection';
import { SQL_BOOKING_SERVICE_LATERAL } from './module-helpers.repo';

export async function dbCustomerCustomeridBookingsFollowupeligibleGet0(customerId: string, followUpDays: number) {
  return await query(
    `SELECT b.*,
            v.business_name as vendor_name,
            v.phone as vendor_phone,
            COALESCE(br_svc.br_name, s.name) AS list_svc_name
     FROM bookings b
     LEFT JOIN vendors v ON b.vendor_id = v.id
     ${SQL_BOOKING_SERVICE_LATERAL}
     LEFT JOIN services s ON s.id = b.service_id
     WHERE b.customer_id = $1
     AND b.status = 'completed'
     AND b.completed_at IS NOT NULL
     AND b.completed_at >= NOW() - ($2::text || ' days')::interval
     ORDER BY b.completed_at DESC`,
    [customerId, followUpDays]
  );
}

export async function dbCustomerCustomeridBookingsFollowupeligibleGet1(booking: { id: string }) {
  return await query('SELECT id FROM prescriptions WHERE booking_id = $1', [booking.id]);
}

export async function dbCustomerCustomeridBookingsFollowupeligibleGet2(booking: { id: string }) {
  return await query('SELECT id FROM reviews WHERE booking_id = $1', [booking.id]);
}
