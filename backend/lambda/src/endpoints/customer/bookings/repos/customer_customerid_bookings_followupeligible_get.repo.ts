import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerCustomeridBookingsFollowupeligibleGet0(customerId, followUpDays, text, interval, SQL_BOOKING_SERVICE_LATERAL, v, br_svc, s, b) {
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

export async function dbCustomerCustomeridBookingsFollowupeligibleGet1(booking) {
  return await query(
            'SELECT id FROM prescriptions WHERE booking_id = $1',
            [booking.id]
          );
}

export async function dbCustomerCustomeridBookingsFollowupeligibleGet2(booking) {
  return await query(
            'SELECT id FROM reviews WHERE booking_id = $1',
            [booking.id]
          );
}

