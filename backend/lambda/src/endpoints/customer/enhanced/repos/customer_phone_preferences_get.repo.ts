import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhonePreferencesGet0(phone: string) {
  return await select('customers', { phone: phone.replace(/\D/g, '') });
}

export async function dbCustomerPhonePreferencesGet1(customer) {
  return await query(
        `SELECT * FROM customer_preferences WHERE customer_id = $1`,
        [customer.id]
      )
}

