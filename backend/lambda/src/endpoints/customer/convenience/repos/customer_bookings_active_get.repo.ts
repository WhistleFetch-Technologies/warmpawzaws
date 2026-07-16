import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerBookingsActiveGet0(customerId, bookingQuery) {
  return await query(bookingQuery, [customerId]);
}

