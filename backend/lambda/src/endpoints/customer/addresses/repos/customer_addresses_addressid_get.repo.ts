import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerAddressesAddressidGet0() {
  return await query(
        `SELECT * FROM customer_addresses WHERE id = $1`,
        [addressId]
      )
}

