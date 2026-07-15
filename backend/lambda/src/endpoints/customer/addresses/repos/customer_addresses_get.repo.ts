import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerAddressesGet0(customer) {
  return await query(
        `SELECT * FROM customer_addresses
         WHERE customer_id = $1
         ORDER BY is_default DESC, created_at DESC`,
        [customer.id]
      )
}

