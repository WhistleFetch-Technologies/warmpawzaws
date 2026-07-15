import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerCustomeridAddressesPost0(customerId) {
  return await select('customers', { id: customerId });
}

export async function dbCustomerCustomeridAddressesPost1(customerId) {
  return await select('customers', { phone: customerId });
}

export async function dbCustomerCustomeridAddressesPost2() {
  return await query(
        'SELECT COUNT(*) as count FROM customer_addresses WHERE customer_id = $1',
        [customer[0].id]
      )
}

export async function dbCustomerCustomeridAddressesPost3() {
  return await query(
          'UPDATE customer_addresses SET is_default = false WHERE customer_id = $1',
          [customer[0].id]
        )
}

export async function dbCustomerCustomeridAddressesPost4(insertPayload) {
  return await insert('customer_addresses', insertPayload);
}

export async function dbCustomerCustomeridAddressesPost5() {
  return await query(
        'SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC',
        [customer[0].id]
      )
}

