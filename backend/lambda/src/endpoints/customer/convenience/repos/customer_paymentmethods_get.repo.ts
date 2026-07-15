import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPaymentmethodsGet0() {
  return await query(
          `SELECT * FROM customer_payment_methods
           WHERE customer_id = $1
           ORDER BY is_default DESC NULLS LAST, created_at DESC NULLS LAST`,
          [customerId]
        );
}

