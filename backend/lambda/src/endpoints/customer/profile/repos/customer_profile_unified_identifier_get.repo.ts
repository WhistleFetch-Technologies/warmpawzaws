import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerProfileUnifiedIdentifierGet0(customerId) {
  return await select('customers', { id: customerId });
}

export async function dbCustomerProfileUnifiedIdentifierGet1() {
  return await query(
          'SELECT * FROM customer_wallets WHERE customer_id = $1',
          [customerId]
        );
}

export async function dbCustomerProfileUnifiedIdentifierGet2() {
  return await query(
          'SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC',
          [customerId]
        );
}

export async function dbCustomerProfileUnifiedIdentifierGet3() {
  return await query(
          'SELECT * FROM bookings WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50',
          [customerId]
        );
}

export async function dbCustomerProfileUnifiedIdentifierGet4() {
  return await query(
          'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50',
          [customerId]
        );
}

export async function dbCustomerProfileUnifiedIdentifierGet5(customerId) {
  return await update('customers', { id: customerId }, { onboarding_status: 'COMPLETED', profile_completed: true });
}

