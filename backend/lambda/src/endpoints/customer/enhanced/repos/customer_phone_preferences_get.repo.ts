import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhonePreferencesGet0() {
  return await select('customers', { phone });
}

export async function dbCustomerPhonePreferencesGet1(customer) {
  return await query(
        `SELECT * FROM customer_preferences WHERE customer_id = $1`,
        [customer.id]
      )
}

