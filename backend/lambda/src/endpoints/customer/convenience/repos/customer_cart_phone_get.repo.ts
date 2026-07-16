import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerCartPhoneGet0(customerId: string) {
  return await query(
        `SELECT ci.id,
                ci.customer_id,
                ci.product_id,
                ci.quantity,
                ci.created_at,
                ci.updated_at,
                p.name AS product_name,
                p.price AS product_price,
                p.images AS product_images,
                p.vendor_id AS product_vendor_id,
                v.business_name AS vendor_name
         FROM cart_items ci
         LEFT JOIN products p ON ci.product_id = p.id
         LEFT JOIN vendors v ON p.vendor_id = v.id
         WHERE ci.customer_id = $1
         ORDER BY ci.created_at DESC`,
        [customerId]
      );
}

