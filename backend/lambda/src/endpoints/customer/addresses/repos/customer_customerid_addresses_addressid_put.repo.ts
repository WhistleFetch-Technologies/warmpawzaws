import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerCustomeridAddressesAddressidPut0(customerId) {
  return await select('customers', { id: customerId });
}

export async function dbCustomerCustomeridAddressesAddressidPut1(customerId) {
  return await select('customers', { phone: customerId });
}

export async function dbCustomerCustomeridAddressesAddressidPut2() {
  return await query(
          'UPDATE customer_addresses SET is_default = false WHERE customer_id = $1',
          [customer[0].id]
        )
}

export async function dbCustomerCustomeridAddressesAddressidPut3(address_line2, city, state, pincode) {
  return await query(
          `SELECT address_line1, address_line2, city, state, pincode, coordinates
           FROM customer_addresses
           WHERE id = $1 AND customer_id = $2
           LIMIT 1`,
          [addressId, customer[0].id]
        )
}

export async function dbCustomerCustomeridAddressesAddressidPut4(addressId, customer, updatePayload) {
  return await update('customer_addresses',
        { id: addressId, customer_id: customer[0].id },
        updatePayload
      );
}

