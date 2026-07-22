import { query } from '../../../../database/rds-connection';

export async function dbCustomerOrdersIdCancelDraftOwnerCheck(
  orderId: string,
  customerId: string,
) {
  return query(
    `SELECT id, order_status, customer_id
     FROM orders
     WHERE id = $1::uuid AND customer_id = $2::uuid
     LIMIT 1`,
    [orderId, customerId],
  );
}
