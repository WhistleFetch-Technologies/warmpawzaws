import { query, select, insert, update } from '../../../../database/rds-connection';

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

