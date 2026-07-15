import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerCartPhoneItemsItemidPut0(itemId) {
  return await query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2 AND customer_id = $3',
        [quantity, itemId, customerId]
      );
}

