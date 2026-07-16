import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerCustomeridAddressesGet0(customerId) {
  return await select('customers', { id: customerId });
}

export async function dbCustomerCustomeridAddressesGet1(customerId) {
  return await select('customers', { phone: customerId });
}

export async function dbCustomerCustomeridAddressesGet2(customer) {
  return await query(
        `SELECT * FROM customer_addresses
         WHERE customer_id = $1
         ORDER BY is_default DESC, created_at DESC`,
        [customer[0].id]
      );
}

