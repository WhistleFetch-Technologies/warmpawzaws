import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPaymentsPhonePost0() {
  return await query(
          `UPDATE customer_payment_methods SET is_default = false WHERE customer_id = $1`,
          [customerId]
        )
}

export async function dbCustomerPaymentsPhonePost1(insertRow) {
  return await insert('customer_payment_methods', insertRow);
}

export async function dbCustomerPaymentsPhonePost2(insertRow) {
  return await insert('customer_payment_methods', insertRow);
}

