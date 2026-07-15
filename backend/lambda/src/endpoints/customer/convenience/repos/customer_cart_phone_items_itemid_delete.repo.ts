import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerCartPhoneItemsItemidDelete0() {
  return await query(
        'DELETE FROM cart_items WHERE id = $1 AND customer_id = $2',
        [itemId, customerId]
      );
}

