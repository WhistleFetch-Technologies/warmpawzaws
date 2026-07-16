import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPaymentmethodsGet0(customerId) {
  return await select('customers', { id: customerId });
}

export async function dbCustomerPaymentmethodsGet1(phone) {
  return await select('customers', { phone });
}

export async function dbCustomerPaymentmethodsGet2(customer) {
  return await query(
        `SELECT * FROM customer_payment_methods 
         WHERE customer_id = $1 AND is_active = true 
         ORDER BY is_default DESC, created_at DESC`,
        [customer.id]
      )
}

