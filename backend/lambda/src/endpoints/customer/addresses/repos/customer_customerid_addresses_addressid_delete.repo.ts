import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerCustomeridAddressesAddressidDelete0(customerId) {
  return await select('customers', { id: customerId });
}

export async function dbCustomerCustomeridAddressesAddressidDelete1(customerId) {
  return await select('customers', { phone: customerId });
}

export async function dbCustomerCustomeridAddressesAddressidDelete2() {
  return await query(
        'DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2',
        [addressId, customer[0].id]
      );
}

