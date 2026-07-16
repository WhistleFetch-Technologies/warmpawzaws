import { query, select } from '../../../../database/rds-connection';

export async function dbSelectCustomersByPhone(phone: string) {
  return await select('customers', { phone });
}

export async function dbSelectCustomerPasswordRow(customerIdResolved, uuid, text, password_hash) {
  return await query(
    `SELECT id, password_hash, phone FROM customers WHERE id = $1::uuid OR phone = $1::text`,
    [customerIdResolved]
  );
}
