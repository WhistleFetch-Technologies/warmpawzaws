import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPaymentsPhonePaymentidDelete0(paymentId, customerId) {
  return await query(
        `DELETE FROM customer_payment_methods WHERE id = $1 AND customer_id = $2`,
        [paymentId, customerId]
      );
}

