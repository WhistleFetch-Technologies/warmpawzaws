import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPaymentmethodsPost0(customerId) {
  return await select('customers', { id: customerId });
}

export async function dbCustomerPaymentmethodsPost1(phone) {
  return await select('customers', { phone });
}

export async function dbCustomerPaymentmethodsPost2(customer) {
  return await query(
          `UPDATE customer_payment_methods SET is_default = false WHERE customer_id = $1`,
          [customer.id]
        )
}

export async function dbCustomerPaymentmethodsPost3(insertRow: Record<string, unknown>) {
  return await insert('customer_payment_methods', insertRow);
}

