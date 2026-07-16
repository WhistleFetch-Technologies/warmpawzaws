import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerSavedPhoneItemsItemidDelete0(customerId, id) {
  return await query(
        `DELETE FROM customer_wishlist
         WHERE customer_id = $1 AND (id = $2 OR product_id = $2)`,
        [customerId, id]
      );
}

