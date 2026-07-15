import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerSavedPhoneGet0(w, p) {
  return await query(
        `SELECT
           w.id,
           w.product_id,
           w.created_at,
           p.name,
           p.price
         FROM customer_wishlist w
         INNER JOIN products p ON w.product_id = p.id
         WHERE w.customer_id = $1
         ORDER BY w.created_at DESC`,
        [customerId]
      );
}

