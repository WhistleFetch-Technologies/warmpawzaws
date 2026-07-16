import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhoneRecommendedservicesGet0(customerId: string) {
  return await query(
        `SELECT DISTINCT s.category
         FROM bookings b
         LEFT JOIN services s ON b.service_id = s.id
         WHERE b.customer_id = $1
           AND b.status IN ('confirmed', 'completed')
           AND s.category IS NOT NULL
         ORDER BY b.created_at DESC
         LIMIT 10`,
        [customerId]
      );
}

