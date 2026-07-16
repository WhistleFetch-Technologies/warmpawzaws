import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhoneLatestbookingbyvendorGet0(customerId, vendorId, b, v) {
  return await query(
        `SELECT b.id as booking_id, b.vendor_id, v.business_name as vendor_name, v.logo_url as vendor_photo
         FROM bookings b
         LEFT JOIN vendors v ON v.id = b.vendor_id
         WHERE b.customer_id = $1 AND b.vendor_id = $2 AND b.status NOT IN ('cancelled', 'rejected')
         ORDER BY b.booking_date DESC, b.booking_time DESC
         LIMIT 1`,
        [customerId, vendorId]
      );
}

