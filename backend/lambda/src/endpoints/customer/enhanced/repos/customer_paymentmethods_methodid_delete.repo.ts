import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPaymentmethodsMethodidDelete0(methodId) {
  return await query(
        `UPDATE customer_payment_methods SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [methodId]
      );
}

