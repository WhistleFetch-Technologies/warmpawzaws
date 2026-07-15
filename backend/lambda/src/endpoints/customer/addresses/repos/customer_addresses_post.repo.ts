import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerAddressesPost0(customer) {
  return await query(
        'SELECT COUNT(*) as count FROM customer_addresses WHERE customer_id = $1',
        [customer.id]
      )
}

export async function dbCustomerAddressesPost1(customer) {
  return await query(
          'UPDATE customer_addresses SET is_default = false WHERE customer_id = $1',
          [customer.id]
        )
}

export async function dbCustomerAddressesPost2(insertPayload) {
  return await insert('customer_addresses', insertPayload);
}

export async function dbCustomerAddressesPost3(customer) {
  return await query(
        'SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC',
        [customer.id]
      )
}

